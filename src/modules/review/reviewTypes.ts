import { z } from 'zod';
import {
  createReviewSchema,
  getMoverIdSchema,
  getMoverReviewsSchema,
  getMyReviewsSchema,
} from './reviewSchema';

export type GetMyReviewsRequest = z.infer<typeof getMyReviewsSchema>;
export type GetMyReviewsData = GetMyReviewsRequest & { userId: string };

export type GetMoverReviewsRequest = z.infer<typeof getMoverReviewsSchema>;
export type GetMoverIdRequest = z.infer<typeof getMoverIdSchema>;
export type GetMoverReviewsData = GetMoverReviewsRequest & GetMoverIdRequest;

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CreateReviewData = CreateReviewInput & { moverId: string };
