import * as estimateRequestRepository from './estimateRequestRepository';
import * as estimateRepository from './estimateRepository';

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

export const toEstimateListItem = (
  estimateRequest: EstimateRequestWithEstimates
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
    },
  })),
  totalCount: estimateRequest.estimates.length,
});

export const toEstimateDetail = (
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
});
