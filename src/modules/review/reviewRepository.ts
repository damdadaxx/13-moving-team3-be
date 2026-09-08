import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../utils/error';
import { CreateReviewData, GetMoverReviewsData } from './reviewTypes';

const reviewRepository = {
  getMyestimate: async (
    where: Prisma.EstimateWhereInput,
    page: number,
    pageSize: number
  ) => {
    const [estimates, estimateCount] = await Promise.all([
      prisma.estimate.findMany({
        where,
        select: {
          id: true,
          price: true,
          mover: {
            select: {
              userId: true,
              imgUrl: true,
              nickname: true,
              shortIntro: true,
            },
          },
          estimateRequest: {
            select: {
              customerId: true,
              serviceType: true,
              departureAddress: true,
              arrivalAddress: true,
              moveDate: true,
              status: true,
            },
          },
          review: true,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.estimate.count({ where }),
    ]);

    return { estimates, estimateCount };
  },
  getMoverReviews: async ({ moverId, page, pageSize }: GetMoverReviewsData) => {
    const reviews = await prisma.review.findMany({
      where: { moverId },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return reviews;
  },
  getReviewCount: async (moverId: string) => {
    const reviewCount = await prisma.review.count({ where: { moverId } });
    return reviewCount;
  },
  getRatingDistribution: async (moverId: string) => {
    const ratingDistribution = await prisma.review.groupBy({
      where: { moverId },
      by: ['rating'],
      _count: { rating: true },
    });
    return ratingDistribution;
  },
  getAverageRating: async (moverId: string) => {
    const averageRating = await prisma.review.aggregate({
      where: { moverId },
      _avg: { rating: true },
    });
    return averageRating;
  },
  createReview: async (
    userId: string,
    { moverId, estimateId, content, rating }: CreateReviewData
  ) => {
    const review = await prisma.review.create({
      data: {
        customerId: userId,
        moverId,
        estimateId,
        content,
        rating,
      },
    });

    return review;
  },
  getMyEstimate: async (estimateId: string) => {
    const estimateInfo = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: {
        estimateRequest: true,
        review: true,
      },
    });

    if (!estimateInfo) {
      throw new NotFoundError('견적 정보를 찾을 수 없습니다..');
    }

    return estimateInfo;
  },
};

export default reviewRepository;
