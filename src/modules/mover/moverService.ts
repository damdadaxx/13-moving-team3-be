import { Prisma, Role } from '../../generated/prisma/client';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/error';
import { paginateByCursor } from '../../utils/cursorPagination';
import { deleteMoverImage, saveMoverImage } from './moverImage';
import moverMapper from './moverMapper';
import moverRepository from './moverRepository';
import type {
  CreateMoverProfileInput,
  GetMoverListQuery,
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

    let imageUrl: string | null = null;

    try {
      if (profileImage) {
        imageUrl = await saveMoverImage(profileImage);
      }

      const profile = await moverRepository.create({
        userId,
        imgUrl: imageUrl,
        nickname: input.nickname,
        careerMonths: input.careerMonths,
        shortIntro: input.shortIntro,
        description: input.description,
        serviceTypes: input.serviceTypes,
        serviceRegions: input.serviceRegions,
      });

      return moverMapper.toProfile(profile);
    } catch (error: unknown) {
      /*
      @ 등록 실패 이미지 롤백

      - DB에 연결되지 않은 로컬 이미지가 남지 않도록 삭제합니다.
      */
      await deleteMoverImage(imageUrl);

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

    if (profileImage) {
      nextImageUrl = await saveMoverImage(profileImage);
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
      if (typeof nextImageUrl === 'string') {
        await deleteMoverImage(nextImageUrl);
      }

      throw error;
    }

    /*
    @ 기존 이미지 정리

    - DB 수정이 성공한 뒤 더 이상 사용하는 곳이 없는 기존 이미지를 삭제합니다.
    - 이 작업은 DB 수정 실패를 처리하는 catch 밖에서 실행합니다.
    - 기존 이미지 삭제만 실패했을 때 새 이미지까지 롤백하여
      DB가 존재하지 않는 파일을 가리키는 상황을 방지합니다.
    */
    if (nextImageUrl !== undefined && existingProfile.imgUrl !== nextImageUrl) {
      await deleteMoverImage(existingProfile.imgUrl);
    }

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
};

export default moverService;
