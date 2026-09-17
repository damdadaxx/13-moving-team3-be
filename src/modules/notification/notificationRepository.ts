import { NotificationType, Prisma } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../utils/error';
import { buildCursorArgs } from '../../utils/cursorPagination';
import { GetNotificationsQuery } from './notificationSchema';

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  content: string;
  targetPath?: string | null;
};

const notificationRepository = {
  /** 알림 생성 — 견적 등 다른 도메인에서 호출. tx를 넘기면 같은 트랜잭션에 묶인다. */
  createNotification: async (
    input: CreateNotificationInput,
    tx?: Prisma.TransactionClient
  ) => {
    // tx 있으면(견적 등 다른 도메인에서 호출) 호출한 쪽의 트랜잭션 안에서 createNotification 호출
    // tx 없으면(알림만 만들 때) prisma 클라이언트 사용됨
    return (tx ?? prisma).notification.create({ data: input });
  },

  /** 알림 존재 여부 확인 (알림 중복 방지) */
  hasNotification: async (
    where: {
      userId: string;
      type: NotificationType;
      targetPath: string;
    },
    tx?: Prisma.TransactionClient
  ) => {
    const found = await (tx ?? prisma).notification.findFirst({
      where,
      select: { id: true },
    });
    return found !== null;
  },

  /** 알림 목록 조회 (커서 페이지네이션, size+1건) */
  getNotifications: async (
    userId: string,
    { cursor, size }: GetNotificationsQuery
  ) => {
    const [notifications, totalCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...buildCursorArgs(cursor, size),
      }),
      prisma.notification.count({ where: { userId } }),
    ]);
    return { notifications, totalCount };
  },

  /** 안 읽은 알림 개수 (GNB 뱃지) */
  getUnreadCount: async (userId: string) => {
    return prisma.notification.count({ where: { userId, isRead: false } });
  },

  /** 알림 읽음 처리 (개별 클릭 시 호출) */
  readNotification: async (userId: string, id: string) => {
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundError('알림을 찾을 수 없습니다.');
    }

    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  },

  /** 전체 읽음 처리 */
  readAllNotifications: async (userId: string) => {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  },
};

export default notificationRepository;
