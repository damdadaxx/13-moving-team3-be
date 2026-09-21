import { estimateRequestRepository } from './estimateRequestRepository';
import { estimateRepository } from './estimateRepository';
import { EMPTY_MOVER_STATS, MoverStats } from './moverStatsRepository';

type EstimateRequestWithEstimates = Awaited<
  ReturnType<typeof estimateRequestRepository.findManyWithEstimates>
>[number];

type EstimateWithDetail = NonNullable<
  Awaited<ReturnType<typeof estimateRepository.findByIdWithDetail>>
>;

type EstimateRequestSummarySource = Pick<
  EstimateRequestWithEstimates,
  | 'id'
  | 'serviceType'
  | 'moveDate'
  | 'departureZipCode'
  | 'departureAddress'
  | 'arrivalZipCode'
  | 'arrivalAddress'
  | 'createdAt'
  | 'status'
>;

const toEstimateRequestSummary = (
  estimateRequest: EstimateRequestSummarySource
) => ({
  estimateRequestId: estimateRequest.id,
  serviceType: estimateRequest.serviceType,
  moveDate: estimateRequest.moveDate,
  departureZipCode: estimateRequest.departureZipCode,
  departureAddress: estimateRequest.departureAddress,
  arrivalZipCode: estimateRequest.arrivalZipCode,
  arrivalAddress: estimateRequest.arrivalAddress,
  requestedAt: estimateRequest.createdAt,
  status: estimateRequest.status,
});

export const estimateMapper = {
  /*
  @ moverStatsByMoverId
  - 별점·리뷰수·확정건수·찜은 MoverProfile 컬럼이 아니라 집계값이라
    service에서 페이지 단위로 한 번에 구해 넘겨줍니다 (moverStatsRepository)
  */
  toEstimateListItem: (
    estimateRequest: EstimateRequestWithEstimates,
    moverStatsByMoverId: Map<string, MoverStats>
  ) => ({
    estimateRequest: toEstimateRequestSummary(estimateRequest),
    estimates: estimateRequest.estimates.map((estimate) => ({
      estimateId: estimate.id,
      price: estimate.price,
      comment: estimate.comment,
      rejectReason: estimate.rejectReason,
      isDesignated: estimate.isDesignated,
      status: estimate.status,
      createdAt: estimate.createdAt,
      mover: {
        moverId: estimate.mover.userId,
        nickname: estimate.mover.nickname,
        imgUrl: estimate.mover.imgUrl,
        careerMonths: estimate.mover.careerMonths,
        ...(moverStatsByMoverId.get(estimate.mover.userId) ??
          EMPTY_MOVER_STATS),
      },
    })),
    totalCount: estimateRequest.estimates.length,
  }),

  toEstimateDetail: (
    estimate: EstimateWithDetail,
    flags: { canConfirm: boolean; canRespond: boolean }
  ) => ({
    estimateId: estimate.id,
    price: estimate.price,
    comment: estimate.comment,
    rejectReason: estimate.rejectReason,
    isDesignated: estimate.isDesignated,
    status: estimate.status,
    createdAt: estimate.createdAt,
    mover: {
      moverId: estimate.mover.userId,
      nickname: estimate.mover.nickname,
      imgUrl: estimate.mover.imgUrl,
      careerMonths: estimate.mover.careerMonths,
    },
    customer: {
      name: estimate.estimateRequest.customer.user.name,
    },
    estimateRequest: toEstimateRequestSummary(estimate.estimateRequest),
    canConfirm: flags.canConfirm,
    canRespond: flags.canRespond,
  }),
};
