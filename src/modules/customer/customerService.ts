import { Prisma } from '../../generated/prisma/client';
import {
  deleteProfileImageByKey,
  deleteProfileImageByUrl,
  StoredProfileImage,
  uploadProfileImage,
} from '../../lib/profileImageStorage';
import { ConflictError, NotFoundError } from '../../utils/error';
import {
  customerRepository,
  CustomerProfileRecord,
} from './customerRepository';
import { deleteLegacyCustomerImage } from './customerUpload';
import { UpsertProfileInput } from './customerValidation';

export type CustomerProfileResponse = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  imgUrl: string | null;
  region: CustomerProfileRecord['region'];
  serviceTypes: CustomerProfileRecord['serviceTypes'][number]['serviceType'][];
  createdAt: Date;
  updatedAt: Date;
};

const toResponse = (
  profile: CustomerProfileRecord
): CustomerProfileResponse => ({
  id: profile.userId,
  userId: profile.userId,
  name: profile.user.name,
  email: profile.user.email,
  phoneNumber: profile.user.phoneNumber,
  imgUrl: profile.imgUrl,
  region: profile.region,
  serviceTypes: profile.serviceTypes.map((item) => item.serviceType),
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
});

const isUniqueConflict = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

/*
@ 새 이미지 롤백

- S3 업로드는 성공했지만 DB 저장이 실패하면, DB에서 사용하지 않는 새 객체를
  삭제합니다.
- 삭제 실패는 기록만 남기고 원래의 DB 오류를 유지합니다.
*/
const rollbackUploadedImage = async (
  image: StoredProfileImage | undefined
): Promise<void> => {
  if (!image) {
    return;
  }

  try {
    await deleteProfileImageByKey(image.key);
  } catch (error: unknown) {
    // 복구 실패는 API 응답 대신 운영 로그에서 확인해야 하므로 의도적으로 기록합니다.
    // eslint-disable-next-line no-console
    console.error('[customer] 새 프로필 이미지 롤백 실패', error);
  }
};

/*
@ 기존 이미지 정리

- DB가 새 URL로 정상 변경된 다음에 이전 이미지를 삭제합니다.
- S3 전환 전 로컬 이미지와 전환 후 S3 이미지를 모두 처리합니다.
- 정리 실패 때문에 이미 성공한 프로필 저장 응답을 500으로 바꾸지 않습니다.
*/
const cleanupPreviousImage = async (imageUrl: string | null): Promise<void> => {
  try {
    await deleteLegacyCustomerImage(imageUrl);
    await deleteProfileImageByUrl(imageUrl);
  } catch (error: unknown) {
    // 정리 실패는 프로필 저장을 취소하지 않고 운영 로그로 추적합니다.
    // eslint-disable-next-line no-console
    console.error('[customer] 기존 프로필 이미지 정리 실패', error);
  }
};

export const customerService = {
  async create(
    userId: string,
    input: UpsertProfileInput,
    file?: Express.Multer.File
  ): Promise<CustomerProfileResponse> {
    const existing = await customerRepository.findByUserId(userId);
    if (existing) {
      throw new ConflictError('이미 등록된 프로필입니다.');
    }

    const uploadedImage = file
      ? await uploadProfileImage(file, 'customers')
      : undefined;

    try {
      const profile = await customerRepository.create({
        userId,
        imgUrl: uploadedImage?.url,
        region: input.region,
        serviceTypes: input.serviceTypes,
      });
      return toResponse(profile);
    } catch (error) {
      await rollbackUploadedImage(uploadedImage);

      if (isUniqueConflict(error)) {
        throw new ConflictError('이미 등록된 프로필입니다.');
      }
      throw error;
    }
  },

  async get(userId: string): Promise<CustomerProfileResponse> {
    const profile = await customerRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('등록된 프로필이 없습니다.');
    }
    return toResponse(profile);
  },

  async update(
    userId: string,
    input: UpsertProfileInput,
    file?: Express.Multer.File
  ): Promise<CustomerProfileResponse> {
    const existing = await customerRepository.findByUserId(userId);
    if (!existing) {
      throw new NotFoundError('등록된 프로필이 없습니다.');
    }

    const uploadedImage = file
      ? await uploadProfileImage(file, 'customers')
      : undefined;

    let profile: CustomerProfileRecord;

    try {
      profile = await customerRepository.updateWithServiceTypes({
        userId,
        imgUrl: uploadedImage?.url,
        region: input.region,
        serviceTypes: input.serviceTypes,
      });
    } catch (error: unknown) {
      await rollbackUploadedImage(uploadedImage);
      throw error;
    }

    if (uploadedImage && existing.imgUrl) {
      await cleanupPreviousImage(existing.imgUrl);
    }

    return toResponse(profile);
  },
};
