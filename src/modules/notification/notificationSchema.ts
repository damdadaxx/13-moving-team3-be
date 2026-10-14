import { z } from 'zod';
import { pageSizeSchema } from '../../utils/paginationSchema';

/** GET /notifications — 커서 기반 무한 스크롤 */
export const getNotificationsQuerySchema = z.object({
  cursor: z.uuid('커서 형식이 올바르지 않습니다.').optional(),
  size: pageSizeSchema(),
});

export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;

/** PATCH /notifications/:id/read */
export const readNotificationParamsSchema = z.object({
  id: z.uuid('알림 ID 형식이 올바르지 않습니다.'),
});

export type ReadNotificationParams = z.infer<
  typeof readNotificationParamsSchema
>;
