import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { CreateReviewData, GetMoverReviewsData } from './reviewTypes';

const reviewRepository = {
  getFindReviewEstimates: async (
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
  getRatingInfo: async (moverId: string, where: Prisma.ReviewWhereInput) => {
    const ratingInfo = await prisma.review.groupBy({
      by: ['moverId'],
      where,
      _count: { rating: true },
      _avg: { rating: true },
    });
    return ratingInfo;
  },
  getRatingDistribution: async (moverId: string) => {
    const ratingDistribution = await prisma.review.groupBy({
      where: { moverId },
      by: ['rating'],
      _count: { rating: true },
    });
    return ratingDistribution;
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
};

export default reviewRepository;
