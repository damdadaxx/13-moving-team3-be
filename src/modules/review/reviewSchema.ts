import { z } from 'zod';
import { pageNumberSchema, pageSizeSchema } from '../../utils/paginationSchema';

export const createReviewSchema = z.object({
  estimateId: z.uuid('견적 ID 형식이 올바르지 않습니다.'),
  content: z
    .string('리뷰 내용을 입력해 주세요.')
    .min(10, '리뷰 내용은 10자 이상 입력해 주세요.'),
  // Review.rating 은 Prisma Int 컬럼이다. 정수가 아니면 DB 에서 터지므로 여기서 막는다.
  rating: z
    .number('평점을 입력해 주세요.')
    .int('평점은 정수여야 합니다.')
    .min(1, '평점은 1 이상이어야 합니다.')
    .max(5, '평점은 5 이하여야 합니다.'),
});

export const getMyReviewsSchema = z.object({
  page: pageNumberSchema(),
  pageSize: pageSizeSchema(),
  hasReview: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const getMoverIdSchema = z.object({
  moverId: z.uuid('기사님 ID 형식이 올바르지 않습니다.'),
});
export const getMoverReviewsSchema = z.object({
  page: pageNumberSchema(),
  pageSize: pageSizeSchema(),
});
