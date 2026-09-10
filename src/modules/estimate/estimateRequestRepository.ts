import { prisma } from '../../lib/prisma';
import { Prisma, ServiceType } from '../../generated/prisma/client';
import { buildCursorArgs } from '../../utils/cursorPagination';

interface EstimateRequestWhereParams {
  customerId?: string;
  serviceType?: ServiceType;
  estimateWhere: Prisma.EstimateWhereInput;
}

interface FindManyWithEstimatesParams extends EstimateRequestWhereParams {
  cursor?: string;
  size: number;
}

const buildWhere = ({
  customerId,
  serviceType,
  estimateWhere,
}: EstimateRequestWhereParams): Prisma.EstimateRequestWhereInput => ({
  customerId,
  serviceType,
  estimates: { some: estimateWhere },
});

export const estimateRequestRepository = {
  findManyWithEstimates: ({
    customerId,
    serviceType,
    estimateWhere,
    cursor,
    size,
  }: FindManyWithEstimatesParams) => {
    return prisma.estimateRequest.findMany({
      where: buildWhere({ customerId, serviceType, estimateWhere }),
      include: {
        estimates: {
          where: estimateWhere,
          orderBy: { createdAt: 'desc' },
          include: {
            mover: {
              select: {
                userId: true,
                nickname: true,
                imgUrl: true,
                careerMonths: true,
              },
            },
          },
        },
      },
      // id를 tie-break로 같이 정렬해야 커서 페이지네이션이 createdAt 동률에서도 안정적으로 동작한다.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...buildCursorArgs(cursor, size),
    });
  },

  count: ({
    customerId,
    serviceType,
    estimateWhere,
  }: EstimateRequestWhereParams) => {
    return prisma.estimateRequest.count({
      where: buildWhere({ customerId, serviceType, estimateWhere }),
    });
  },
};
