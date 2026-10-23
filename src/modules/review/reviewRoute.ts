import express from 'express';
import reviewController from './reviewController';
import {
  createDraftReviewSchema,
  createReviewSchema,
  getMoverIdSchema,
  getMoverReviewsSchema,
  getMyReviewsSchema,
} from './reviewSchema';
import { validate } from '../../middlewares/validation';
import { authenticate } from '../../middlewares/authenticate';
import { reviewDraftRateLimit } from '../../middlewares/aiRateLimit';

const reviewRouter = express.Router();

reviewRouter.get(
  '/me',
  authenticate,
  validate(getMyReviewsSchema, 'query'),
  reviewController.getMyReviews
);

reviewRouter.get(
  '/mover/:moverId',
  validate(getMoverIdSchema, 'params'),
  validate(getMoverReviewsSchema, 'query'),
  reviewController.getMoverReviews
);

reviewRouter.post(
  '/',
  authenticate,
  validate(createReviewSchema, 'body'),
  reviewController.createReview
);

//Gemini 비용 때문에 유저 단위로 요청을 제한한다 (하루 5회, 실패는 횟수에서 빼지 않음)
reviewRouter.post(
  '/draft',
  authenticate,
  reviewDraftRateLimit,
  validate(createDraftReviewSchema, 'body'),
  reviewController.createDraftReview
);
export default reviewRouter;
