import { NotificationType, Prisma } from '../../generated/prisma/client';
import { paginateByCursor } from '../../utils/cursorPagination';
import notificationRepository, {
  type CreateNotificationInput,
} from './notificationRepository';
import { GetNotificationsQuery } from './notificationSchema';
import notificationSse from './notificationSse';

type CreatedNotification = Awaited<
  ReturnType<typeof notificationRepository.createNotification>
>;

/** 안 읽은 알림 개수 (GNB 뱃지) 푸시 */
const pushUnreadCount = async (userId: string) => {
  const unreadCount = await notificationRepository.getUnreadCount(userId);
  notificationSse.publish(userId, 'unread-count', { unreadCount });
  return unreadCount;
};

const notificationService = {
  /** 트랜잭션 안에서만 저장. SSE는 커밋 후 publishCreated로 보낸다. */
  create: async (
    input: CreateNotificationInput,
    tx?: Prisma.TransactionClient
  ) => {
    return notificationRepository.createNotification(input, tx);
  },

  createMany: async (
    inputs: CreateNotificationInput[],
    tx?: Prisma.TransactionClient
  ) => {
    return Promise.all(
      inputs.map((input) =>
        notificationRepository.createNotification(input, tx)
      )
    );
  },

  hasNotification: async (
    where: {
      userId: string;
      type: NotificationType;
      targetPath: string;
    },
    tx?: Prisma.TransactionClient
  ) => {
    return notificationRepository.hasNotification(where, tx);
  },

  /** 커밋된 알림을 SSE로 푸시한다. 트랜잭션 안에서는 호출하지 않는다. */
  publishCreated: async (notifications: CreatedNotification[]) => {
    if (notifications.length === 0) return;

    for (const notification of notifications) {
      notificationSse.publish(
        notification.userId,
        'notification',
        notification
      );
    }

    // 중복된 userId 제거
    const userIds = [...new Set(notifications.map((row) => row.userId))];
    await Promise.all(userIds.map((userId) => pushUnreadCount(userId)));
  },

  /** 알림 생성 후 해당 유저 SSE로 푸시 (단독 생성용) */
  createNotification: async (input: CreateNotificationInput) => {
    const notification = await notificationRepository.createNotification(input);
    await notificationService.publishCreated([notification]);
    return notification;
  },

  /** 알림 목록 조회 */
  getNotifications: async (userId: string, query: GetNotificationsQuery) => {
    const { notifications, totalCount } =
      await notificationRepository.getNotifications(userId, query);
    const { items, nextCursor } = paginateByCursor(notifications, query.size);
    return { list: items, nextCursor, totalCount };
  },

  /** 안 읽은 알림 개수 (GNB 뱃지) */
  getUnreadCount: async (userId: string) => {
    return notificationRepository.getUnreadCount(userId);
  },

  /** 알림 읽음 처리 (개별 클릭 시 호출) */
  readNotification: async (userId: string, id: string) => {
    const notification = await notificationRepository.readNotification(
      userId,
      id
    );
    await pushUnreadCount(userId);
    return notification;
  },

  /** 전체 읽음 처리 */
  readAllNotifications: async (userId: string) => {
    const result = await notificationRepository.readAllNotifications(userId);
    await pushUnreadCount(userId);
    return result;
  },
};

export default notificationService;
