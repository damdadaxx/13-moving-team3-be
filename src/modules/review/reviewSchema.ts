import { z } from 'zod';

export const createReviewSchema = z.object({
  estimateId: z.uuid(),
  content: z.string().min(10),
  rating: z.number().min(1).max(5),
});

export const getMyReviewsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).default(10),
  hasReview: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const getMoverIdSchema = z.object({
  moverId: z.uuid(),
});
export const getMoverReviewsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).default(10),
});
