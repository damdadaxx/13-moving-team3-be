import { Prisma } from '../../generated/prisma/client';
import { ConflictError, NotFoundError } from '../../utils/error';
import {
  customerRepository,
  CustomerProfileRecord,
} from './customerRepository';
import { deleteLocalUpload } from '../../middlewares/upload';
import { UpsertProfileInput } from './customerValidation';

type UpsertProfileCommand = UpsertProfileInput & { imgUrl?: string };

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

export const customerService = {
  async create(
    userId: string,
    input: UpsertProfileCommand
  ): Promise<CustomerProfileResponse> {
    const existing = await customerRepository.findByUserId(userId);
    if (existing) {
      throw new ConflictError('이미 등록된 프로필입니다.');
    }

    try {
      const profile = await customerRepository.create({
        userId,
        imgUrl: input.imgUrl,
        region: input.region,
        serviceTypes: input.serviceTypes,
      });
      return toResponse(profile);
    } catch (error) {
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
    input: UpsertProfileCommand
  ): Promise<CustomerProfileResponse> {
    const existing = await customerRepository.findByUserId(userId);
    if (!existing) {
      throw new NotFoundError('등록된 프로필이 없습니다.');
    }

    const profile = await customerRepository.updateWithServiceTypes({
      userId,
      imgUrl: input.imgUrl,
      region: input.region,
      serviceTypes: input.serviceTypes,
    });

    if (input.imgUrl && existing.imgUrl) {
      deleteLocalUpload(existing.imgUrl);
    }

    return toResponse(profile);
  },
};
