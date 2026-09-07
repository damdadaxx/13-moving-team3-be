import * as estimateRequestRepository from './estimateRequestRepository';

type EstimateRequestWithEstimates = Awaited<
  ReturnType<typeof estimateRequestRepository.findManyWithEstimates>
>[number];

export const toEstimateListItem = (
  estimateRequest: EstimateRequestWithEstimates
) => ({
  estimateRequest: {
    estimateRequestId: estimateRequest.id,
    serviceType: estimateRequest.serviceType,
    moveDate: estimateRequest.moveDate,
    departureZipCode: estimateRequest.departureZipCode,
    departureAddress: estimateRequest.departureAddress,
    arrivalZipCode: estimateRequest.arrivalZipCode,
    arrivalAddress: estimateRequest.arrivalAddress,
    requestedAt: estimateRequest.createdAt,
    status: estimateRequest.status,
  },
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
