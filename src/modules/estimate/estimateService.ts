import { EstimateStatus, Role } from '../../generated/prisma/client';
import { ForbiddenError, NotFoundError } from '../../utils/error';
import * as estimateRequestRepository from './estimateRequestRepository';
import * as estimateRepository from './estimateRepository';
import { buildEstimateWhere } from './estimateFilter';
import { toEstimateDetail, toEstimateListItem } from './estimateMapper';
import {
  GetEstimateDetailParamsDto,
  GetEstimatesQueryDto,
} from './estimateSchema';

export const getEstimates = async (
  userId: string,
  role: Role,
  query: GetEstimatesQueryDto
) => {
  const { status, serviceType, cursor, size } = query;

  const estimateWhere = buildEstimateWhere(role, userId, status);
  const customerId = role === Role.CUSTOMER ? userId : undefined;

  // size + 1건을 조회해서, 초과분이 있으면 다음 페이지가 있다는 뜻이다.
  const [estimateRequests, totalCount] = await Promise.all([
    estimateRequestRepository.findManyWithEstimates({
      customerId,
      serviceType,
      estimateWhere,
      cursor,
      take: size + 1,
    }),
    estimateRequestRepository.count({
      customerId,
      serviceType,
      estimateWhere,
    }),
  ]);

  const hasNext = estimateRequests.length > size;
  const page = hasNext ? estimateRequests.slice(0, size) : estimateRequests;
  const nextCursor = hasNext ? page[page.length - 1].id : null;

  return {
    list: page.map(toEstimateListItem),
    nextCursor,
    totalCount,
  };
};

export const getEstimateDetail = async (
  userId: string,
  role: Role,
  estimateId: GetEstimateDetailParamsDto['estimateId']
) => {
  const estimate = await estimateRepository.findByIdWithDetail(estimateId);

  if (!estimate) {
    throw new NotFoundError('견적을 찾을 수 없습니다.', 'ESTIMATE_NOT_FOUND');
  }

  const isOwner =
    role === Role.CUSTOMER
      ? estimate.estimateRequest.customerId === userId
      : estimate.moverId === userId;

  if (!isOwner) {
    throw new ForbiddenError('본인의 견적/요청이 아닙니다.');
  }

  const isRequestPending = estimate.estimateRequest.status === 'PENDING';

  return toEstimateDetail(estimate, {
    canConfirm:
      role === Role.CUSTOMER &&
      isRequestPending &&
      estimate.status === EstimateStatus.PROPOSED,
    canRespond:
      role === Role.MOVER &&
      isRequestPending &&
      estimate.status === EstimateStatus.DESIGNATED,
  });
};
