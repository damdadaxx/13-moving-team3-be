import { Role } from '../../generated/prisma/client';
import * as estimateRequestRepository from './estimateRequestRepository';
import { buildEstimateWhere } from './estimateFilter';
import { toEstimateListItem } from './estimateMapper';
import { GetEstimatesQueryDto } from './estimateDto';

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
