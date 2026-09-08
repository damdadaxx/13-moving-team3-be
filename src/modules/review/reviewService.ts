import { Prisma } from '../../generated/prisma/client';
import { BadRequestError, ForbiddenError } from '../../utils/error';
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
    const where: Prisma.EstimateWhereInput = {
      estimateRequest: {
        customerId: userId,
        status: 'COMPLETED',
      },
      review: hasReview ? { isNot: null } : { is: null },
    };

    const { estimates, estimateCount } = await reviewRepository.getMyestimate(
      where,
      page,
      pageSize
    );

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
    const ratingAvg = ratingInfo[0]?._avg.rating ?? 0;

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
    const estimateInfo = await reviewRepository.getMyEstimate(estimateId);

    //견적서의 주인 인지 확인한다.
    if (estimateInfo.estimateRequest.customerId !== userId)
      throw new ForbiddenError('리뷰 작성 권한이 없는 견적서입니다.');

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
