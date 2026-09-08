import { prisma } from '../../lib/prisma';
import { Prisma } from '../../generated/prisma/client';

export const estimateRepository = {
  findByIdWithDetail: (id: string) => {
    return prisma.estimate.findUnique({
      where: { id },
      include: {
        mover: {
          select: {
            userId: true,
            nickname: true,
            imgUrl: true,
            careerMonths: true,
          },
        },
        estimateRequest: {
          include: {
            customer: {
              include: {
                user: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });
  },

  update: (id: string, data: Prisma.EstimateUpdateInput) => {
    return prisma.estimate.update({ where: { id }, data });
  },

  // 견적 확정: 해당 견적은 ACCEPTED, 같은 요청의 나머지 PROPOSED 견적은 NOT_SELECTED,
  // 견적 요청은 CONFIRMED로 같이 전환한다. DESIGNATED로 남은 행은 건드리지 않는다.
  confirmAndCloseOthers: (params: {
    estimateId: string;
    estimateRequestId: string;
  }) => {
    return prisma.$transaction([
      prisma.estimate.update({
        where: { id: params.estimateId },
        data: { status: 'ACCEPTED' },
      }),
      prisma.estimate.updateMany({
        where: {
          estimateRequestId: params.estimateRequestId,
          status: 'PROPOSED',
          id: { not: params.estimateId },
        },
        data: { status: 'NOT_SELECTED' },
      }),
      prisma.estimateRequest.update({
        where: { id: params.estimateRequestId },
        data: { status: 'CONFIRMED' },
      }),
    ]);
  },
};
