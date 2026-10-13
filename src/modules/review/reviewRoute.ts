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

reviewRouter.post(
  '/draft',
  authenticate,
  validate(createDraftReviewSchema, 'body'),
  reviewController.createDraftReview
);
export default reviewRouter;
