import { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/error';
import notificationService from './notificationService';
import notificationSse from './notificationSse';
import type {
  GetNotificationsQuery,
  ReadNotificationParams,
} from './notificationSchema';

// TODO: 다른 곳에서도 사용됨. 유틸함수로 빼기 (authController.ts 에 있음)
const getUserId = (req: Request) => {
  const userId = req.auth?.sub;
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
};

const notificationController = {
  /** SSE 알림 스트림 — 연결 시 현재 뱃지, 이후 생성/읽음 이벤트를 푸시 */
  streamNotifications: async (req: Request, res: Response) => {
    const userId = getUserId(req);
    notificationSse.open(userId, req, res);
    const unreadCount = await notificationService.getUnreadCount(userId);
    notificationSse.send(res, 'unread-count', { unreadCount });
  },

  /** 알림 목록 조회 */
  getNotifications: async (req: Request, res: Response) => {
    const query = req.validatedData as GetNotificationsQuery;
    const data = await notificationService.getNotifications(
      getUserId(req),
      query
    );
    return res.json({
      success: true,
      data,
      message: '알림 목록 조회 성공',
    });
  },

  /** 안 읽은 알림 개수 (GNB 뱃지) */
  getUnreadCount: async (req: Request, res: Response) => {
    const unreadCount = await notificationService.getUnreadCount(
      getUserId(req)
    );
    return res.json({
      success: true,
      data: { unreadCount },
      message: '안 읽은 알림 개수 조회 성공',
    });
  },

  /** 알림 읽음 처리 (개별 클릭 시 호출) */
  readNotification: async (req: Request, res: Response) => {
    const { id } = req.validatedData as ReadNotificationParams;
    const notification = await notificationService.readNotification(
      getUserId(req),
      id
    );
    return res.json({
      success: true,
      data: notification,
      message: '알림 읽음 처리 성공',
    });
  },

  /** 전체 읽음 처리 */
  readAllNotifications: async (req: Request, res: Response) => {
    const notifications = await notificationService.readAllNotifications(
      getUserId(req)
    );
    return res.json({
      success: true,
      data: notifications,
      message: '전체 알림 읽음 처리 성공',
    });
  },
};

export default notificationController;
