import { z } from 'zod';

export const likeMoverIdSchema = z.object({
  moverId: z.uuid('기사 ID는 필수 입력 필드입니다.'),
});

export const getLikeMoverListSchema = z.object({
  cursor: z.uuid().optional(),
  size: z.coerce.number().min(1).default(10),
});

export const bulkDeleteLikeSchema = z.object({
  moverIds: z.array(z.uuid('기사 ID는 필수 입력 필드입니다.')),
});
