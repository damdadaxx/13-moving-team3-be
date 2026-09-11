import { Prisma } from '../../generated/prisma/client';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/error';
import { estimateRepository } from '../estimate/estimateRepository';
import reviewRepository from './reviewRepository';
import {
  CreateReviewInput,
  GetMoverReviewsData,
  GetMyReviewsData,
} from './reviewTypes';

const reviewService = {
  getMyReviews: async ({
    userId,
    page,
    pageSize,
    hasReview,
  }: GetMyReviewsData) => {
    //hasReview에 따라 리뷰할수있는 견적서를 가져올지 리뷰를 완료한 견적서를 가져올지 정한다.
    //실제로 계약한 견적(ACCEPTED)만 리뷰 대상이다. 같은 요청에 달렸어도
    //탈락(NOT_SELECTED)·반려(REJECTED)·응답 전(DESIGNATED) 견적은 제외한다.
    const where: Prisma.EstimateWhereInput = {
      status: 'ACCEPTED',
      estimateRequest: {
        customerId: userId,
        status: 'COMPLETED',
      },
      review: hasReview ? { isNot: null } : { is: null },
    };

    const { estimates, estimateCount } =
      await reviewRepository.getFindReviewEstimates(where, page, pageSize);

    //페이지 수 계산을 위해 전체에서 나눈후 올림한다.
    const totalPages = Math.ceil(estimateCount / pageSize);

    return { list: estimates, totalPages };
  },
  getMoverReviews: async ({ moverId, page, pageSize }: GetMoverReviewsData) => {
    const where: Prisma.ReviewWhereInput = { moverId };

    const [reviews, distribution, ratingInfo] = await Promise.all([
      reviewRepository.getMoverReviews({
        moverId,
        page,
        pageSize,
      }),
      reviewRepository.getRatingDistribution(moverId),
      reviewRepository.getRatingInfo(moverId, where),
    ]);

    const ratingDistribution = distribution.map((data) => {
      return { rating: data.rating, count: data._count.rating };
    });

    const reviewCount = ratingInfo[0]?._count.rating ?? 0;
    const ratingAvg = Number((ratingInfo[0]?._avg.rating ?? 0).toFixed(1));

    const totalPages = Math.ceil(reviewCount / pageSize);
    return {
      list: reviews,
      ratingDistribution,
      ratingAvg,
      reviewCount,
      totalPages,
    };
  },
  createReview: async (
    userId: string,
    { estimateId, content, rating }: CreateReviewInput
  ) => {
    const estimateInfo =
      await estimateRepository.findByIdWithDetail(estimateId);

    if (!estimateInfo) {
      throw new NotFoundError('견적 정보를 찾을 수 없습니다.');
    }
    //견적서의 주인 인지 확인한다.
    if (estimateInfo.estimateRequest.customerId !== userId)
      throw new ForbiddenError('리뷰 작성 권한이 없는 견적서입니다.');

    //실제로 계약한 견적인지 검증하기.
    //이 검증이 없으면 같은 요청에 달린 탈락·반려 견적에도 리뷰를 쓸 수 있어
    //계약하지 않은 기사님의 평점을 조작할 수 있다.
    if (estimateInfo.status !== 'ACCEPTED')
      throw new BadRequestError('확정한 견적서만 리뷰를 할 수 있습니다.');

    //이사 완료 상태인지 검증하기.
    if (estimateInfo.estimateRequest.status !== 'COMPLETED')
      throw new BadRequestError(
        '완료된 상태의 견적서만 리뷰를 할 수 있습니다.'
      );

    //리뷰가 작성된 적 있는지 검증하기.
    if (estimateInfo.review != null)
      throw new BadRequestError('이미 작성된 리뷰가 있는 견적서 입니다.');

    const review = await reviewRepository.createReview(userId, {
      moverId: estimateInfo.moverId,
      estimateId,
      content,
      rating,
    });

    return review;
  },
};
export default reviewService;
