import { Request, Response } from 'express';
import {
  CreateReviewInput,
  GetMoverReviewsRequest,
  GetMyReviewsRequest,
} from './reviewTypes';
import reviewService from './reviewService';
import { UnauthorizedError } from '../../utils/error';

const reviewController = {
  getMyReviews: async (req: Request, res: Response) => {
    const userId = req.auth?.sub;
    if (!userId) {
      throw new UnauthorizedError();
    }
    const { page, pageSize, hasReview } =
      req.validatedData as GetMyReviewsRequest;

    const reviews = await reviewService.getMyReviews({
      userId,
      page,
      pageSize,
      hasReview,
    });

    res.status(200).json({ success: true, data: reviews });
  },
  getMoverReviews: async (req: Request, res: Response) => {
    const { moverId } = req.params as { moverId: string };
    const { page, pageSize } = req.validatedData as GetMoverReviewsRequest;

    const reviews = await reviewService.getMoverReviews({
      moverId,
      page,
      pageSize,
    });

    res.status(200).json({ success: true, data: reviews });
  },

  createReview: async (req: Request, res: Response) => {
    const userId = req.auth?.sub;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const { estimateId, content, rating } =
      req.validatedData as CreateReviewInput;

    const review = await reviewService.createReview(userId, {
      estimateId,
      content,
      rating,
    });

    return res.status(201).json({ success: true, data: review });
  },
};
export default reviewController;
