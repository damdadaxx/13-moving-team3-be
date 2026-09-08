import { EstimateStatus, Prisma, Role } from '../../generated/prisma/client';
import { BadRequestError } from '../../utils/error';

const CLOSED_STATUSES: EstimateStatus[] = [
  EstimateStatus.ACCEPTED,
  EstimateStatus.NOT_SELECTED,
  EstimateStatus.EXPIRED,
];

// 유저(고객)에게는 절대 노출하면 안 되는 상태 (price가 null인 행)
const HIDDEN_FROM_CUSTOMER: EstimateStatus[] = [
  EstimateStatus.DESIGNATED,
  EstimateStatus.REJECTED,
];

const parseStatuses = (status?: string): EstimateStatus[] | undefined => {
  if (!status) return undefined;
  if (status === 'closed') return CLOSED_STATUSES;
  return status.split(',') as EstimateStatus[];
};

export const estimateFilter = {
  buildEstimateWhere: (
    role: Role,
    userId: string,
    status?: string
  ): Prisma.EstimateWhereInput => {
    const statuses = parseStatuses(status);

    if (role === Role.CUSTOMER) {
      return {
        status: statuses
          ? { in: statuses, notIn: HIDDEN_FROM_CUSTOMER }
          : { notIn: HIDDEN_FROM_CUSTOMER },
      };
    }

    if (role === Role.MOVER) {
      return {
        moverId: userId,
        ...(statuses ? { status: { in: statuses } } : {}),
      };
    }

    throw new BadRequestError('알 수 없는 역할입니다.');
  },
};
