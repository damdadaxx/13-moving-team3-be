import notificationService from '../../src/modules/notification/notificationService';
import notificationRepository from '../../src/modules/notification/notificationRepository';
import notificationSse from '../../src/modules/notification/notificationSse';

jest.mock('../../src/modules/notification/notificationRepository');
jest.mock('../../src/modules/notification/notificationSse');

const readNotification = jest.mocked(notificationRepository.readNotification);
const readAll = jest.mocked(notificationRepository.readAllNotifications);
const getUnreadCount = jest.mocked(notificationRepository.getUnreadCount);
const publish = jest.mocked(notificationSse.publish);

describe('notificationService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('readNotification: 읽음 처리 후 갱신된 안 읽은 개수를 SSE 로 보낸다', async () => {
    readNotification.mockResolvedValue({ id: 'noti-1' } as Awaited<
      ReturnType<typeof notificationRepository.readNotification>
    >);
    getUnreadCount.mockResolvedValue(4);

    await notificationService.readNotification('user-1', 'noti-1');

    expect(readNotification).toHaveBeenCalledWith('user-1', 'noti-1');
    expect(publish).toHaveBeenCalledWith('user-1', 'unread-count', {
      unreadCount: 4,
    });
  });

  test('readNotification: 저장소가 실패하면 SSE 를 보내지 않는다', async () => {
    readNotification.mockRejectedValue(new Error('not found'));

    await expect(
      notificationService.readNotification('user-1', 'noti-x')
    ).rejects.toThrow('not found');
    expect(publish).not.toHaveBeenCalled();
  });

  test('readAllNotifications: 전부 읽은 뒤 안 읽은 개수 0 을 보낸다', async () => {
    readAll.mockResolvedValue({ count: 3 });
    getUnreadCount.mockResolvedValue(0);

    await notificationService.readAllNotifications('user-1');

    expect(publish).toHaveBeenCalledWith('user-1', 'unread-count', {
      unreadCount: 0,
    });
  });
});
