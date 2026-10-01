import { z } from 'zod';
import { pageSizeSchema } from '../../utils/paginationSchema';

/** GET /notifications — 커서 기반 무한 스크롤 */
export const getNotificationsQuerySchema = z.object({
  // TODO: 에러 메세지가 모두 다름. 정리 필요
  cursor: z.uuid('cursor 형식이 올바르지 않습니다.').optional(),
  size: pageSizeSchema(),
});

export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;

/** PATCH /notifications/:id/read */
export const readNotificationParamsSchema = z.object({
  id: z.uuid('id 형식이 올바르지 않습니다.'),
});

export type ReadNotificationParams = z.infer<
  typeof readNotificationParamsSchema
>;
