import { EstimateStatus, Role } from '../../generated/prisma/client';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/error';
import { estimateRequestRepository } from './estimateRequestRepository';
import { estimateRepository } from './estimateRepository';
import { estimateFilter } from './estimateFilter';
import { estimateMapper } from './estimateMapper';
import { paginateByCursor } from '../../utils/cursorPagination';
import {
  acceptEstimateSchema,
  GetEstimateDetailParamsDto,
  GetEstimatesQueryDto,
  proposeEstimateSchema,
  rejectEstimateSchema,
} from './estimateSchema';

type EstimateStatusAction = 'PROPOSED' | 'REJECTED' | 'ACCEPTED';

// action별로 요구되는 역할과, 전환 전 견적이 반드시 갖고 있어야 하는 상태.
const TRANSITION_RULES: Record<
  EstimateStatusAction,
  { role: Role; from: EstimateStatus }
> = {
  PROPOSED: { role: Role.MOVER, from: EstimateStatus.DESIGNATED },
  REJECTED: { role: Role.MOVER, from: EstimateStatus.DESIGNATED },
  ACCEPTED: { role: Role.CUSTOMER, from: EstimateStatus.PROPOSED },
};

const isEstimateStatusAction = (
  value: unknown
): value is EstimateStatusAction =>
  value === 'PROPOSED' || value === 'REJECTED' || value === 'ACCEPTED';

export const estimateService = {
  getEstimates: async (
    userId: string,
    role: Role,
    query: GetEstimatesQueryDto
  ) => {
    const { status, serviceType, cursor, size } = query;

    const estimateWhere = estimateFilter.buildEstimateWhere(
      role,
      userId,
      status
    );
    const customerId = role === Role.CUSTOMER ? userId : undefined;

    const [estimateRequests, totalCount] = await Promise.all([
      estimateRequestRepository.findManyWithEstimates({
        customerId,
        serviceType,
        estimateWhere,
        cursor,
        size,
      }),
      estimateRequestRepository.count({
        customerId,
        serviceType,
        estimateWhere,
      }),
    ]);

    const { items, nextCursor } = paginateByCursor(estimateRequests, size);

    return {
      list: items.map(estimateMapper.toEstimateListItem),
      nextCursor,
      totalCount,
    };
  },

  getEstimateDetail: async (
    userId: string,
    role: Role,
    estimateId: GetEstimateDetailParamsDto['estimateId']
  ) => {
    const estimate = await estimateRepository.findByIdWithDetail(estimateId);

    if (!estimate) {
      throw new NotFoundError('견적을 찾을 수 없습니다.');
    }

    const isOwner =
      role === Role.CUSTOMER
        ? estimate.estimateRequest.customerId === userId
        : estimate.moverId === userId;

    if (!isOwner) {
      throw new ForbiddenError('본인의 견적/요청이 아닙니다.');
    }

    if (
      role === Role.CUSTOMER &&
      estimateFilter.isHiddenFromCustomer(estimate.status)
    ) {
      throw new NotFoundError('견적을 찾을 수 없습니다.');
    }

    const isRequestPending = estimate.estimateRequest.status === 'PENDING';

    return estimateMapper.toEstimateDetail(estimate, {
      canConfirm:
        role === Role.CUSTOMER &&
        isRequestPending &&
        estimate.status === EstimateStatus.PROPOSED,
      canRespond:
        role === Role.MOVER &&
        isRequestPending &&
        estimate.status === EstimateStatus.DESIGNATED,
    });
  },

  updateEstimateStatus: async (
    userId: string,
    role: Role,
    estimateId: GetEstimateDetailParamsDto['estimateId'],
    body: unknown
  ) => {
    const status = (body as { status?: unknown } | null)?.status;

    if (!isEstimateStatusAction(status)) {
      throw new BadRequestError('허용되지 않는 전환입니다.');
    }

    const estimate = await estimateRepository.findByIdWithDetail(estimateId);

    if (!estimate) {
      throw new NotFoundError('견적을 찾을 수 없습니다.');
    }

    const isOwner =
      role === Role.CUSTOMER
        ? estimate.estimateRequest.customerId === userId
        : estimate.moverId === userId;

    if (!isOwner) {
      throw new ForbiddenError('본인의 견적/요청이 아닙니다.');
    }

    const rule = TRANSITION_RULES[status];

    if (role !== rule.role) {
      throw new ForbiddenError(
        rule.role === Role.MOVER
          ? '이 전환은 기사만 할 수 있습니다.'
          : '이 전환은 일반 유저만 할 수 있습니다.'
      );
    }

    if (estimate.estimateRequest.status === 'CONFIRMED') {
      throw new ConflictError('이미 확정된 요청입니다.');
    }

    // PENDING이 아니거나(COMPLETED/EXPIRED) 이사일이 지났으면 더 이상 전환할 수 없다.
    // moveDate를 status와 별도로 체크하는 이유: 이사일이 지나도 status를 EXPIRED로
    // 자동 전환해주는 배치가 아직 없어서, status만 보면 지난 요청이 계속 PENDING으로 남는다.
    if (
      estimate.estimateRequest.status !== 'PENDING' ||
      estimate.estimateRequest.moveDate.getTime() < Date.now()
    ) {
      throw new ConflictError('현재 상태에서는 이 전환이 불가능합니다.');
    }

    if (estimate.status !== rule.from) {
      throw new ConflictError('현재 상태에서는 이 전환이 불가능합니다.');
    }

    if (status === 'PROPOSED') {
      const { price, comment } = proposeEstimateSchema.parse(body);
      await estimateRepository.update(estimateId, {
        status: 'PROPOSED',
        price,
        comment,
      });
    } else if (status === 'REJECTED') {
      const { rejectReason } = rejectEstimateSchema.parse(body);
      await estimateRepository.update(estimateId, {
        status: 'REJECTED',
        rejectReason,
      });
    } else {
      acceptEstimateSchema.parse(body);
      await estimateRepository.confirmAndCloseOthers({
        estimateId,
        estimateRequestId: estimate.estimateRequestId,
      });
    }

    return {
      estimateId,
      estimateRequestId: estimate.estimateRequestId,
      status,
    };
  },
};
