import { z } from 'zod';

export const createReviewSchema = z.object({
  estimateId: z.uuid('견적서 ID는 필수 입력 필드입니다.'),
  content: z.string().min(10, '리뷰는 10자 이상 적용해주세요.'),
  rating: z
    .number()
    .min(1, '평점은 1점 이상 적용해주세요.')
    .max(5, '평점은 5점 이하 적용해주세요.'),
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
  moverId: z.uuid('기사 ID는 필수 입력 필드입니다.'),
});
export const getMoverReviewsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).default(10),
});
