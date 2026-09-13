import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import notificationController from './notificationController';
import {
  getNotificationsQuerySchema,
  readNotificationParamsSchema,
} from './notificationSchema';
import { validate } from '../../middlewares/validation';

const notificationRouter = Router();

// GET /notifications/stream SSE (GNB 실시간 뱃지·새 알림)
notificationRouter.get(
  '/stream',
  authenticate,
  notificationController.streamNotifications
);

// GET /notifications 알림 목록 조회
notificationRouter.get(
  '/',
  authenticate,
  validate(getNotificationsQuerySchema, 'query'),
  notificationController.getNotifications
);

// GET /notifications/unread-count 안 읽은 알림 개수 (GNB 뱃지)
notificationRouter.get(
  '/unread-count',
  authenticate,
  notificationController.getUnreadCount
);

// PATCH /notifications/read-all 전체 읽음 처리
notificationRouter.patch(
  '/read-all',
  authenticate,
  notificationController.readAllNotifications
);

// PATCH /notifications/:id/read 알림 읽음 처리 (개별 클릭 시 호출)
notificationRouter.patch(
  '/:id/read',
  authenticate,
  validate(readNotificationParamsSchema, 'params'),
  notificationController.readNotification
);

export default notificationRouter;
