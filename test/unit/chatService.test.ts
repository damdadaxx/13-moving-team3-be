import { Role } from '../../src/generated/prisma/client';
import { chatService } from '../../src/modules/chat/chatService';
import { chatRoomRepository } from '../../src/modules/chat/chatRoomRepository';
import {
  chatRepository,
  type ChatMessageRow,
} from '../../src/modules/chat/chatRepository';
import { ForbiddenError, NotFoundError } from '../../src/utils/error';

jest.mock('../../src/modules/chat/chatRoomRepository');
jest.mock('../../src/modules/chat/chatRepository');

const findAccessInfo = jest.mocked(chatRoomRepository.findAccessInfo);
const findRoomsForUser = jest.mocked(chatRoomRepository.findRoomsForUser);
const listMessages = jest.mocked(chatRepository.listMessages);
const insertMessage = jest.mocked(chatRepository.insertMessage);
const imageExists = jest.mocked(chatRepository.imageExists);
const markRead = jest.mocked(chatRepository.markRead);
const countUnread = jest.mocked(chatRepository.countUnread);
const getLastMessage = jest.mocked(chatRepository.getLastMessage);
const signImageUrls = jest.mocked(chatRepository.signImageUrls);
const createImageUploadUrl = jest.mocked(chatRepository.createImageUploadUrl);

type AccessInfo = Awaited<ReturnType<typeof chatRoomRepository.findAccessInfo>>;

const ESTIMATE_ID = 'estimate-1';
const QUERY = { size: 30 };

const accessInfo = (
  overrides: {
    status?: 'ACCEPTED' | 'PROPOSED';
    moverId?: string;
    requestStatus?: 'CONFIRMED' | 'COMPLETED' | 'PENDING';
    customerId?: string;
  } = {}
): AccessInfo =>
  ({
    id: ESTIMATE_ID,
    status: overrides.status ?? 'ACCEPTED',
    moverId: overrides.moverId ?? 'mover-1',
    estimateRequest: {
      status: overrides.requestStatus ?? 'CONFIRMED',
      customerId: overrides.customerId ?? 'customer-1',
    },
  }) as AccessInfo;

const message = (
  id: string,
  overrides: Partial<ChatMessageRow> = {}
): ChatMessageRow => ({
  id,
  estimateId: ESTIMATE_ID,
  senderId: 'customer-1',
  content: `메시지 ${id}`,
  imagePath: null,
  isRead: false,
  createdAt: new Date('2026-10-13T00:00:00.000Z'),
  ...overrides,
});

describe('chatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('접근 권한', () => {
    test('견적이 없으면 404 이고 메시지를 조회하지 않는다', async () => {
      findAccessInfo.mockResolvedValue(null);

      await expect(
        chatService.getMessages('customer-1', Role.CUSTOMER, ESTIMATE_ID, QUERY)
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(listMessages).not.toHaveBeenCalled();
    });

    test.each([
      ['다른 고객', 'customer-2', Role.CUSTOMER],
      ['다른 기사', 'mover-2', Role.MOVER],
    ])('%s 이면 403', async (_label, userId, role) => {
      findAccessInfo.mockResolvedValue(accessInfo());

      await expect(
        chatService.getMessages(userId, role, ESTIMATE_ID, QUERY)
      ).rejects.toThrow('본인의 채팅방이 아닙니다.');
      expect(listMessages).not.toHaveBeenCalled();
    });

    test('확정되지 않은 견적이면 403', async () => {
      findAccessInfo.mockResolvedValue(accessInfo({ status: 'PROPOSED' }));

      await expect(
        chatService.getMessages('customer-1', Role.CUSTOMER, ESTIMATE_ID, QUERY)
      ).rejects.toThrow('확정된 견적의 채팅만 이용할 수 있습니다.');
    });

    test('요청이 확정·완료가 아니면 403', async () => {
      findAccessInfo.mockResolvedValue(
        accessInfo({ requestStatus: 'PENDING' })
      );

      await expect(
        chatService.getMessages('mover-1', Role.MOVER, ESTIMATE_ID, QUERY)
      ).rejects.toThrow('현재 상태에서는 채팅을 이용할 수 없습니다.');
    });

    test('고객과 담당 기사는 메시지를 조회할 수 있다', async () => {
      findAccessInfo.mockResolvedValue(accessInfo());
      listMessages.mockResolvedValue([]);

      await chatService.getMessages(
        'customer-1',
        Role.CUSTOMER,
        ESTIMATE_ID,
        QUERY
      );
      await chatService.getMessages('mover-1', Role.MOVER, ESTIMATE_ID, QUERY);

      expect(listMessages).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendMessage', () => {
    test('이사 완료 후에는 403 이고 메시지를 저장하지 않는다', async () => {
      findAccessInfo.mockResolvedValue(
        accessInfo({ requestStatus: 'COMPLETED' })
      );

      await expect(
        chatService.sendMessage('customer-1', Role.CUSTOMER, ESTIMATE_ID, {
          content: '안녕하세요',
        })
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(insertMessage).not.toHaveBeenCalled();
    });

    test('이 방에 없는 이미지 경로면 403', async () => {
      findAccessInfo.mockResolvedValue(accessInfo());
      imageExists.mockResolvedValue(false);

      await expect(
        chatService.sendMessage('mover-1', Role.MOVER, ESTIMATE_ID, {
          imagePath: `${ESTIMATE_ID}/missing.png`,
        })
      ).rejects.toThrow('이 채팅방에 업로드된 이미지가 아닙니다.');
      expect(insertMessage).not.toHaveBeenCalled();
    });

    test('성공하면 estimateId 와 보낸 사람을 저장하고, 소켓 미초기화 상태여도 실패하지 않는다', async () => {
      findAccessInfo.mockResolvedValue(accessInfo());
      insertMessage.mockResolvedValue(message('1'));

      const result = await chatService.sendMessage(
        'customer-1',
        Role.CUSTOMER,
        ESTIMATE_ID,
        { content: '안녕하세요' }
      );

      expect(insertMessage).toHaveBeenCalledWith({
        estimateId: ESTIMATE_ID,
        senderId: 'customer-1',
        content: '안녕하세요',
        imagePath: undefined,
      });
      expect(result).toMatchObject({
        messageId: '1',
        senderId: 'customer-1',
        content: '메시지 1',
      });
    });
  });

  describe('완료 후 조회·읽음', () => {
    test('완료된 방도 읽음 처리와 안읽음 수 조회는 허용한다', async () => {
      findAccessInfo.mockResolvedValue(
        accessInfo({ requestStatus: 'COMPLETED' })
      );
      countUnread.mockResolvedValue(3);

      await chatService.markRead('mover-1', Role.MOVER, ESTIMATE_ID);
      const unread = await chatService.getUnreadCount(
        'mover-1',
        Role.MOVER,
        ESTIMATE_ID
      );

      expect(markRead).toHaveBeenCalledWith({
        estimateId: ESTIMATE_ID,
        readerId: 'mover-1',
      });
      expect(unread).toEqual({ unreadCount: 3 });
    });

    test('완료된 방의 이미지 업로드는 403', async () => {
      findAccessInfo.mockResolvedValue(
        accessInfo({ requestStatus: 'COMPLETED' })
      );

      await expect(
        chatService.createImageUpload(
          'customer-1',
          Role.CUSTOMER,
          ESTIMATE_ID,
          {
            fileName: 'photo.png',
          }
        )
      ).rejects.toThrow('이사 완료 후에는 기록 조회만 가능합니다.');
      expect(createImageUploadUrl).not.toHaveBeenCalled();
    });
  });

  describe('getRooms', () => {
    test('참여 방이 없으면 메시지 저장소를 조회하지 않는다', async () => {
      findRoomsForUser.mockResolvedValue([]);

      const result = await chatService.getRooms('customer-1', Role.CUSTOMER);

      expect(result).toEqual({ list: [] });
      expect(countUnread).not.toHaveBeenCalled();
      expect(getLastMessage).not.toHaveBeenCalled();
    });

    test('안읽음 수 조회가 실패해도 거절이 새지 않고 에러로 끝난다', async () => {
      findRoomsForUser.mockResolvedValue([
        {
          id: ESTIMATE_ID,
          mover: { userId: 'mover-1', nickname: '김이사', imgUrl: null },
          estimateRequest: {
            customerId: 'customer-1',
            customer: { imgUrl: null, user: { name: '박고객' } },
          },
        },
      ] as Awaited<ReturnType<typeof chatRoomRepository.findRoomsForUser>>);
      countUnread.mockRejectedValue(new Error('db down'));
      getLastMessage.mockResolvedValue(null);

      await expect(
        chatService.getRooms('customer-1', Role.CUSTOMER)
      ).rejects.toThrow('db down');
    });

    test('상대방 정보와 마지막 메시지를 붙이고 최신 메시지 순으로 정렬한다', async () => {
      findRoomsForUser.mockResolvedValue([
        {
          id: 'older',
          mover: { userId: 'mover-1', nickname: '김이사', imgUrl: 'mover.png' },
          estimateRequest: {
            customerId: 'customer-1',
            customer: { imgUrl: 'customer.png', user: { name: '박고객' } },
          },
        },
        {
          id: 'newer',
          mover: { userId: 'mover-1', nickname: '김이사', imgUrl: null },
          estimateRequest: {
            customerId: 'customer-1',
            customer: { imgUrl: null, user: { name: '박고객' } },
          },
        },
      ] as Awaited<ReturnType<typeof chatRoomRepository.findRoomsForUser>>);
      countUnread.mockImplementation(async ({ estimateId }) =>
        estimateId === 'newer' ? 2 : 0
      );
      getLastMessage.mockImplementation(async (estimateId) =>
        estimateId === 'newer'
          ? message('2', {
              estimateId: 'newer',
              imagePath: 'newer/a.png',
              createdAt: new Date('2026-10-13T12:00:00.000Z'),
            })
          : message('1', {
              estimateId: 'older',
              createdAt: new Date('2026-10-13T01:00:00.000Z'),
            })
      );
      signImageUrls.mockResolvedValue(
        new Map([['newer/a.png', 'https://signed.example/a.png']])
      );

      const asCustomer = await chatService.getRooms(
        'customer-1',
        Role.CUSTOMER
      );

      expect(asCustomer.list.map((room) => room.estimateId)).toEqual([
        'newer',
        'older',
      ]);
      expect(asCustomer.list[0]).toMatchObject({
        otherParty: { id: 'mover-1', name: '김이사' },
        unreadCount: 2,
        lastMessage: { imageUrl: 'https://signed.example/a.png' },
      });
      expect(signImageUrls).toHaveBeenCalledWith(['newer/a.png']);
    });
  });
});
