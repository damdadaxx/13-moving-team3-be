import { z } from 'zod';
import { pageSizeSchema } from '../../utils/paginationSchema';

export const likeMoverIdSchema = z.object({
  moverId: z.uuid('기사님 ID 형식이 올바르지 않습니다.'),
});

export const getLikeMoverListSchema = z.object({
  cursor: z.uuid().optional(),
  size: pageSizeSchema(),
});

export const bulkDeleteLikeSchema = z.object({
  moverIds: z
    .array(z.uuid('기사님 ID 형식이 올바르지 않습니다.'))
    .min(1, '기사님 ID를 1개 이상 선택해 주세요.')
    .refine((ids) => new Set(ids).size === ids.length, {
      message: '기사님 ID를 중복해서 선택할 수 없습니다.',
    }),
});
