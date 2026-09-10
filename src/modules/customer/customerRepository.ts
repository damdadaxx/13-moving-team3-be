import { prisma } from '../../lib/prisma';
import { Region, ServiceType } from '../../generated/prisma/client';

const profileInclude = {
  user: {
    select: {
      name: true,
      email: true,
      phoneNumber: true,
    },
  },
  serviceTypes: {
    select: { serviceType: true },
  },
} as const;

export type CustomerProfileRecord = {
  userId: string;
  imgUrl: string | null;
  region: Region;
  createdAt: Date;
  updatedAt: Date;
  user: {
    name: string;
    email: string;
    phoneNumber: string | null;
  };
  serviceTypes: { serviceType: ServiceType }[];
};

export const customerRepository = {
  findByUserId(userId: string) {
    return prisma.customerProfile.findUnique({
      where: { userId },
      include: profileInclude,
    });
  },

  create(data: {
    userId: string;
    imgUrl?: string | null;
    region: Region;
    serviceTypes: ServiceType[];
  }) {
    return prisma.customerProfile.create({
      data: {
        userId: data.userId,
        imgUrl: data.imgUrl,
        region: data.region,
        serviceTypes: {
          create: data.serviceTypes.map((serviceType) => ({ serviceType })),
        },
      },
      include: profileInclude,
    });
  },

  updateWithServiceTypes(data: {
    userId: string;
    imgUrl?: string | null;
    region: Region;
    serviceTypes: ServiceType[];
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.customerServiceType.deleteMany({
        where: { customerId: data.userId },
      });
      await tx.customerServiceType.createMany({
        data: data.serviceTypes.map((serviceType) => ({
          customerId: data.userId,
          serviceType,
        })),
      });
      return tx.customerProfile.update({
        where: { userId: data.userId },
        data: {
          ...(data.imgUrl !== undefined ? { imgUrl: data.imgUrl } : {}),
          region: data.region,
        },
        include: profileInclude,
      });
    });
  },
};
