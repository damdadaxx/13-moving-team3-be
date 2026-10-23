import { Request, Response } from 'express';
import {
  CreateDraftReviewInput,
  CreateReviewInput,
  GetMoverReviewsRequest,
  GetMyReviewsRequest,
} from './reviewTypes';
import reviewService from './reviewService';
import { UnauthorizedError } from '../../utils/error';
import { getAiUsageFromRequest } from '../../middlewares/aiRateLimit';

const reviewController = {
  getMyReviews: async (req: Request, res: Response) => {
    const userId = req.auth?.sub;
    if (!userId) {
      throw new UnauthorizedError();
    }
    const { page, pageSize, hasReview, sort } =
      req.validatedData as GetMyReviewsRequest;

    const reviews = await reviewService.getMyReviews({
      userId,
      page,
      pageSize,
      hasReview,
      sort,
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
  createDraftReview: async (req: Request, res: Response) => {
    const userId = req.auth?.sub;
    if (!userId) {
      throw new UnauthorizedError();
    }
    const { rating, estimateId, locale } =
      req.validatedData as CreateDraftReviewInput;

    const result = await reviewService.createDraftReview(userId, {
      estimateId,
      rating,
      locale,
    });
    //usage 는 오늘 남은 초안 생성 횟수 (limit · remaining · resetAt 만)
    return res.status(200).json({
      success: true,
      data: { ...result, usage: getAiUsageFromRequest(req, 'reviewDraft') },
    });
  },
};
export default reviewController;
