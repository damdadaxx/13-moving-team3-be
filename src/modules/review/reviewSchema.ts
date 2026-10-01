import { z } from 'zod';
import { pageNumberSchema, pageSizeSchema } from '../../utils/paginationSchema';

export const createReviewSchema = z.object({
  estimateId: z.uuid('견적서 ID는 필수 입력 필드입니다.'),
  content: z.string().min(10, '리뷰는 10자 이상 적용해주세요.'),
  // Review.rating 은 Prisma Int 컬럼이다. 정수가 아니면 DB 에서 터지므로 여기서 막는다.
  rating: z
    .number()
    .int('평점은 정수로 적용해주세요.')
    .min(1, '평점은 1점 이상 적용해주세요.')
    .max(5, '평점은 5점 이하 적용해주세요.'),
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
  moverId: z.uuid('기사 ID는 필수 입력 필드입니다.'),
});
export const getMoverReviewsSchema = z.object({
  page: pageNumberSchema(),
  pageSize: pageSizeSchema(),
});
