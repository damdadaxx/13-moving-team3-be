import { Prisma, Role } from '../../generated/prisma/client';
import {
  deleteProfileImageByKey,
  deleteProfileImageByUrl,
  StoredProfileImage,
  uploadProfileImage,
} from '../../lib/profileImageStorage';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/error';
import { paginateByCursor } from '../../utils/cursorPagination';
import { deleteCacheByPrefix } from '../../lib/redis';
import { generateJson } from '../../lib/gemini';
// S3 전환 전에 로컬에 저장했던 이미지를 교체·삭제할 때 정리합니다.
import { deleteLegacyMoverImage } from './moverImage';
import moverMapper from './moverMapper';
import moverRepository from './moverRepository';
import {
  buildMoverAiSearchPrompt,
  moverAiSearchResponseSchema,
} from './moverAiSearchPrompt';
import { moverAiSearchResultSchema } from './moverValidation';
import type {
  CreateMoverProfileInput,
  GetMoverListQuery,
  MoverAiSearchResult,
  UpdateMoverProfileInput,
} from './moverValidation';

interface CreateProfileParams {
  userId: string;
  role: Role;
  input: CreateMoverProfileInput;
  profileImage?: Express.Multer.File;
}

interface UpdateProfileParams {
  userId: string;
  role: Role;
  input: UpdateMoverProfileInput;
  profileImage?: Express.Multer.File;
}

interface GetMyProfileParams {
  userId: string;
  role: Role;
}

/*
@ validateMoverRole

- 본인 프로필 등록·조회·수정은 MOVER 역할만 사용할 수 있습니다.
- 공개 목록과 상세 조회에는 이 검사를 적용하지 않습니다.
*/
const validateMoverRole = (role: Role): void => {
  if (role !== Role.MOVER) {
    throw new ForbiddenError('기사님 회원만 사용할 수 있는 기능입니다.');
  }
};

/*
@ 새 이미지 롤백

- S3 업로드는 성공했지만 DB 저장이 실패한 경우에만 사용합니다.
- 롤백 삭제가 실패해도 원래 발생한 DB 오류를 바꾸지 않고 로그로 남깁니다.
*/
const rollbackUploadedImage = async (
  image: StoredProfileImage | null
): Promise<void> => {
  if (!image) {
    return;
  }

  try {
    await deleteProfileImageByKey(image.key);
  } catch (error: unknown) {
    // 복구 실패는 API 응답 대신 운영 로그에서 확인해야 하므로 의도적으로 기록합니다.
    // eslint-disable-next-line no-console
    console.error('[mover] 새 프로필 이미지 롤백 실패', error);
  }
};

/*
@ 기존 이미지 정리

- DB가 새 이미지 URL 또는 null로 정상 변경된 뒤 실행합니다.
- S3 전환 전에 저장한 로컬 이미지와 전환 후 S3 이미지를 모두 처리합니다.
- 정리 실패만으로 이미 성공한 프로필 수정 요청을 500으로 만들지 않습니다.
*/
const cleanupPreviousImage = async (imageUrl: string | null): Promise<void> => {
  try {
    await deleteLegacyMoverImage(imageUrl);
    await deleteProfileImageByUrl(imageUrl);
  } catch (error: unknown) {
    // 정리 실패는 프로필 저장을 취소하지 않고 운영 로그로 추적합니다.
    // eslint-disable-next-line no-console
    console.error('[mover] 기존 프로필 이미지 정리 실패', error);
  }
};

/*=================================================
기사님 Service
=================================================*/

const moverService = {
  /*
  @ createProfile

  - 로그인한 기사님의 프로필을 최초 등록합니다.
  - 이미지 저장 후 DB 등록에 실패하면 새 이미지를 삭제합니다.
  */
  createProfile: async ({
    userId,
    role,
    input,
    profileImage,
  }: CreateProfileParams) => {
    validateMoverRole(role);

    const existingProfile = await moverRepository.findByUserId(userId);

    if (existingProfile) {
      throw new ConflictError('이미 기사님 프로필이 등록되어 있습니다.');
    }

    let uploadedImage: StoredProfileImage | null = null;

    try {
      if (profileImage) {
        uploadedImage = await uploadProfileImage(profileImage, 'movers');
      }

      const profile = await moverRepository.create({
        userId,
        imgUrl: uploadedImage?.url ?? null,
        nickname: input.nickname,
        careerMonths: input.careerMonths,
        shortIntro: input.shortIntro,
        description: input.description,
        serviceTypes: input.serviceTypes,
        serviceRegions: input.serviceRegions,
      });

      // 새 기사님이 목록에 보이도록 기사님 조회 캐시 삭제
      await deleteCacheByPrefix('cache:/mover');

      return moverMapper.toProfile(profile);
    } catch (error: unknown) {
      /*
      @ 등록 실패 이미지 롤백

      - DB에 연결되지 않은 S3 이미지가 남지 않도록 삭제합니다.
      */
      await rollbackUploadedImage(uploadedImage);

      /*
      @ 동시 중복 등록

      - 두 요청이 중복 검사를 동시에 통과해도 DB unique 제약조건의
        P2002를 409 ConflictError로 변환합니다.
      */
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictError('이미 기사님 프로필이 등록되어 있습니다.');
      }

      throw error;
    }
  },

  /*
  @ getMyProfile

  - GET /mover/profile에서 로그인한 기사님 본인의 프로필을 조회합니다.
  - 요청 body, query, params가 없으므로 인증 정보만 사용합니다.
  */
  getMyProfile: async ({ userId, role }: GetMyProfileParams) => {
    validateMoverRole(role);

    const profile = await moverRepository.findByUserId(userId);

    if (!profile) {
      throw new NotFoundError('기사님 프로필을 찾을 수 없습니다.');
    }

    return moverMapper.toProfile(profile);
  },

  /*
  @ updateProfile

  - 로그인한 기사님의 프로필에서 전달된 값만 수정합니다.
  - 새 이미지와 removeImage=true를 동시에 보낼 수 없습니다.
  */
  updateProfile: async ({
    userId,
    role,
    input,
    profileImage,
  }: UpdateProfileParams) => {
    validateMoverRole(role);

    const existingProfile = await moverRepository.findByUserId(userId);

    if (!existingProfile) {
      throw new NotFoundError('수정할 기사님 프로필을 찾을 수 없습니다.');
    }

    if (profileImage && input.removeImage === true) {
      throw new BadRequestError(
        '프로필 이미지 교체와 삭제를 동시에 요청할 수 없습니다.'
      );
    }

    /*
    @ 빈 PATCH 요청 검사

    - removeImage=false는 삭제 요청이 아니므로 수정값으로 보지 않습니다.
    */
    const hasUpdateValue =
      input.nickname !== undefined ||
      input.careerMonths !== undefined ||
      input.shortIntro !== undefined ||
      input.description !== undefined ||
      input.serviceTypes !== undefined ||
      input.serviceRegions !== undefined ||
      input.removeImage === true ||
      profileImage !== undefined;

    if (!hasUpdateValue) {
      throw new BadRequestError(
        '수정할 프로필 정보를 한 개 이상 입력해 주세요.'
      );
    }

    /*
    @ nextImageUrl 값의 의미

    - undefined: 기존 이미지 유지
    - string: 새 이미지로 교체
    - null: 기존 이미지 삭제
    */
    let nextImageUrl: string | null | undefined;
    let uploadedImage: StoredProfileImage | null = null;

    if (profileImage) {
      uploadedImage = await uploadProfileImage(profileImage, 'movers');
      nextImageUrl = uploadedImage.url;
    } else if (input.removeImage === true) {
      nextImageUrl = null;
    }

    let updatedProfile: Awaited<ReturnType<typeof moverRepository.update>>;

    try {
      updatedProfile = await moverRepository.update(userId, {
        imgUrl: nextImageUrl,
        nickname: input.nickname,
        careerMonths: input.careerMonths,
        shortIntro: input.shortIntro,
        description: input.description,
        serviceTypes: input.serviceTypes,
        serviceRegions: input.serviceRegions,
      });
    } catch (error: unknown) {
      /*
      @ 수정 실패 이미지 롤백

      - DB 수정 전에 새로 저장한 이미지만 삭제합니다.
      - null은 이미지 삭제 요청이므로 삭제할 새 파일이 없습니다.
      */
      await rollbackUploadedImage(uploadedImage);

      throw error;
    }

    /*
    @ 기존 이미지 정리

    - DB 수정이 성공한 뒤 더 이상 사용하는 곳이 없는 기존 이미지를 삭제합니다.
    - 이 작업은 DB 수정 실패를 처리하는 catch 밖에서 실행합니다.
    - 기존 이미지 삭제만 실패했을 때는 새 이미지를 롤백하지 않습니다.
      그래야 DB가 삭제된 새 파일을 가리키는 상황을 방지할 수 있습니다.
    */
    if (nextImageUrl !== undefined && existingProfile.imgUrl !== nextImageUrl) {
      await cleanupPreviousImage(existingProfile.imgUrl);
    }

    // 수정된 프로필이 목록·상세에 바로 보이도록 기사님 조회 캐시 삭제
    await deleteCacheByPrefix('cache:/mover');

    return moverMapper.toProfile(updatedProfile);
  },

  /*
@ getMovers

- GET /mover의 검색, 필터, 정렬, 커서 페이지네이션 결과를 반환합니다.
- 목록 조회와 전체 개수 조회는 서로 독립적이므로 동시에 실행합니다.
- Repository는 다음 페이지 존재 여부를 확인하기 위해 size + 1건을 조회합니다.
- 공용 paginateByCursor가 초과 조회한 한 건을 제거하고
  다음 요청에 사용할 nextCursor를 만들어 줍니다.
*/
  getMovers: async (query: GetMoverListQuery) => {
    const [movers, totalCount] = await Promise.all([
      moverRepository.findMany(query),
      moverRepository.count(query),
    ]);

    /*
  @ paginateByCursor

  - movers가 size보다 많으면 마지막 초과 데이터를 제외합니다.
  - 실제 응답에 포함된 마지막 기사님의 id를 nextCursor로 반환합니다.
  - 다음 데이터가 없으면 nextCursor는 null입니다.
  */
    const { items, nextCursor } = paginateByCursor(movers, query.size);

    return {
      list: items.map(moverMapper.toListItem),
      nextCursor,
      totalCount,
    };
  },

  /*
  @ getMoverById

  - GET /mover/:id에서 특정 기사님의 공개 상세 정보를 조회합니다.
  - 존재하지 않는 ID는 공용 에러 계약의 NOT_FOUND로 처리됩니다.
  */
  getMoverById: async (id: string) => {
    const profile = await moverRepository.findByIdWithStats(id);

    if (!profile) {
      throw new NotFoundError('기사님 프로필을 찾을 수 없습니다.');
    }

    return moverMapper.toDetail(profile);
  },

  /*
  @ parseAiSearch

  - GET /mover/ai-search. 자연어 검색 문장을 목록 API 필터로 바꿉니다.
  - 목록 조회는 하지 않습니다. FE가 이 값으로 기존 GET /mover 를 호출합니다
    (기존 캐시·커서 페이지네이션을 그대로 씁니다).
  - DB 에 아무것도 저장하지 않고, 검색 문장은 로그에 남기지 않습니다.

  @ 주의사항
  - 꺾쇠괄호를 지워 프롬프트의 <query> 구분자를 사용자가 닫지 못하게 합니다.
  - 모델 출력은 moverAiSearchResultSchema 로 다시 검증해, 이상한 값은 null 이 됩니다.
  */
  parseAiSearch: async (query: string): Promise<MoverAiSearchResult> => {
    const sanitizedQuery = query.replace(/[<>]/g, ' ');

    const output = await generateJson({
      prompt: buildMoverAiSearchPrompt(sanitizedQuery),
      schema: moverAiSearchResponseSchema,
    });

    return moverAiSearchResultSchema.parse(
      typeof output === 'object' && output !== null ? output : {}
    );
  },
};

export default moverService;
