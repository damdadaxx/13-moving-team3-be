import { z } from 'zod';

export const likeMoverIdSchema = z.object({
  moverId: z.uuid('기사 ID는 필수 입력 필드입니다.'),
});

export const getLikeMoverListSchema = z.object({
  nextCursorId: z.uuid().optional(),
  limit: z.coerce.number().min(1).default(5),
});
export const deleteLikeSchema = z.object({
  likeId: z.uuid('like ID는 필수 입력 필드입니다.'),
});
export const bulkDeleteLikeSchema = z.object({
  likeIds: z.array(z.uuid('like ID는 필수 입력 필드입니다.')),
});
