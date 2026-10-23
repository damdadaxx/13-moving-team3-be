import { Role } from '../../generated/prisma/client';
import { ForbiddenError, NotFoundError } from '../../utils/error';
import { chatRoomRepository } from './chatRoomRepository';
import { chatRepository } from './chatRepository';
import type { ChatMessageRow } from './chatRepository';
import { chatMapper } from './chatMapper';
import { paginateByCursor } from '../../utils/cursorPagination';
import { broadcastToRoom } from '../../lib/socket';
import {
  CreateImageUploadInput,
  GetMessagesQueryDto,
  SendMessageInput,
} from './chatSchema';

type RoomAccess = {
  customerId: string;
  moverId: string;
  canWrite: boolean;
};

/** 채팅 접근 권한 확인
 * - 견적 상태(ACCEPTED)와 요청 상태(CONFIRMED/COMPLETED)를 같이 봐야 한다.
 * - ACCEPTED로 전환되면 estimateRequest는 항상 CONFIRMED이고, 이사일이 지나면
 * - 스케줄러(closePastEstimateRequestsJob)가 COMPLETED로 바꾼다 — 그때부터는 조회만 허용.
 */
export const assertAccess = async (
  userId: string,
  role: Role,
  estimateId: string
): Promise<RoomAccess> => {
  const estimate = await chatRoomRepository.findAccessInfo(estimateId);

  if (!estimate) {
    throw new NotFoundError('견적을 찾을 수 없습니다.');
  }

  const customerId = estimate.estimateRequest.customerId;
  const moverId = estimate.moverId;
  const isParticipant =
    role === Role.CUSTOMER ? userId === customerId : userId === moverId;

  if (!isParticipant) {
    throw new ForbiddenError('본인의 채팅방이 아닙니다.');
  }

  if (estimate.status !== 'ACCEPTED') {
    throw new ForbiddenError('확정된 견적의 채팅만 이용할 수 있습니다.');
  }

  const requestStatus = estimate.estimateRequest.status;
  if (requestStatus !== 'CONFIRMED' && requestStatus !== 'COMPLETED') {
    throw new ForbiddenError('현재 상태에서는 채팅을 이용할 수 없습니다.');
  }

  return { customerId, moverId, canWrite: requestStatus === 'CONFIRMED' };
};

/** 채팅 접근 권한 확인
 * - 이사 완료 후에는 기록 조회만 허용
 */
const assertWritable = (access: RoomAccess) => {
  if (!access.canWrite) {
    throw new ForbiddenError('이사 완료 후에는 기록 조회만 가능합니다.');
  }
};

/** 메시지들의 imagePath(저장된 path)을 조회 시점에 signed URL로 바꿔치기한다.
 * - chat-images 버킷이 private라 path를 그대로 내려주면 클라이언트가 쓸 수 없다.
 */
const withSignedImageUrls = async (
  rows: ChatMessageRow[]
): Promise<ChatMessageRow[]> => {
  const paths = rows
    .map((row) => row.imagePath)
    .filter((path): path is string => !!path);
  if (paths.length === 0) return rows;

  const signedUrlByPath = await chatRepository.signImageUrls(paths);
  return rows.map((row) =>
    row.imagePath
      ? { ...row, imagePath: signedUrlByPath.get(row.imagePath) ?? null }
      : row
  );
};

export const chatService = {
  /** 내가 참여 중인 채팅방 목록 (상대방 정보 + 마지막 메시지 + 안읽음 수) */
  getRooms: async (userId: string, role: Role) => {
    const rooms = await chatRoomRepository.findRoomsForUser(userId, role);
    if (rooms.length === 0) return { list: [] };

    const estimateIds = rooms.map((room) => room.id);

    // 방마다 따로(병렬로) 조회한다. 두 Promise.all을 하나로 묶어서 기다린다 — 따로 두면
    // await 안 한 쪽이 이후 await보다 먼저 reject될 때 그 reject를 아무도 못 잡아
    // unhandledRejection으로 서버가 죽는다.
    const [unreadCounts, lastMessages] = await Promise.all([
      Promise.all(
        estimateIds.map((estimateId) =>
          chatRepository.countUnread({ estimateId, readerId: userId })
        )
      ),
      Promise.all(
        estimateIds.map((estimateId) =>
          chatRepository.getLastMessage(estimateId)
        )
      ),
    ]);

    const nonNullMessages = lastMessages.filter(
      (row): row is ChatMessageRow => row !== null
    );
    const signedMessages = await withSignedImageUrls(nonNullMessages);

    const signedLastMessageByEstimateId = new Map<string, ChatMessageRow>();
    let signedIndex = 0;
    estimateIds.forEach((estimateId, index) => {
      if (lastMessages[index] !== null) {
        signedLastMessageByEstimateId.set(
          estimateId,
          signedMessages[signedIndex]
        );
        signedIndex++;
      }
    });

    const unreadCountByEstimateId = new Map(
      estimateIds.map((estimateId, index) => [estimateId, unreadCounts[index]])
    );

    const list = rooms.map((room) => {
      const otherParty =
        role === Role.CUSTOMER
          ? {
              id: room.mover.userId,
              name: room.mover.nickname,
              imgUrl: room.mover.imgUrl,
            }
          : {
              id: room.estimateRequest.customerId,
              name: room.estimateRequest.customer.user.name,
              imgUrl: room.estimateRequest.customer.imgUrl,
            };

      return chatMapper.toRoom({
        estimateId: room.id,
        otherParty,
        lastMessage: signedLastMessageByEstimateId.get(room.id) ?? null,
        unreadCount: unreadCountByEstimateId.get(room.id) ?? 0,
      });
    });

    // 마지막 메시지가 최신인 방부터. 메시지가 없는 방은 맨 뒤로 밀린다.
    list.sort((a, b) => {
      const bTime = b.lastMessage
        ? new Date(b.lastMessage.createdAt).getTime()
        : 0;
      const aTime = a.lastMessage
        ? new Date(a.lastMessage.createdAt).getTime()
        : 0;
      return bTime - aTime;
    });

    return { list };
  },

  /** 채팅 메시지 조회 */
  getMessages: async (
    userId: string,
    role: Role,
    estimateId: string,
    query: GetMessagesQueryDto
  ) => {
    await assertAccess(userId, role, estimateId);

    const rows = await chatRepository.listMessages({
      estimateId,
      cursor: query.cursor,
      size: query.size,
    });

    const { items, nextCursor } = paginateByCursor(rows, query.size);
    const signedItems = await withSignedImageUrls(items);
    return { list: signedItems.map(chatMapper.toMessage), nextCursor };
  },

  /** 채팅 메시지 전송 */
  sendMessage: async (
    userId: string,
    role: Role,
    estimateId: string,
    input: SendMessageInput
  ) => {
    const access = await assertAccess(userId, role, estimateId);
    assertWritable(access);

    if (input.imagePath) {
      const exists = await chatRepository.imageExists(
        estimateId,
        input.imagePath
      );
      if (!exists) {
        throw new ForbiddenError('이 채팅방에 업로드된 이미지가 아닙니다.');
      }
    }

    const row = await chatRepository.insertMessage({
      estimateId,
      senderId: userId,
      content: input.content,
      imagePath: input.imagePath,
    });

    const [signedRow] = await withSignedImageUrls([row]);
    const message = chatMapper.toMessage(signedRow);

    broadcastToRoom(estimateId, 'message', message);

    return message;
  },

  /** 채팅 메시지 읽음 처리
   * - 새 메시지를 쓰는 게 아니라 "읽었다"는 상태 갱신이라, 조회(getMessages/getUnreadCount)와
   *   같이 이사 완료(COMPLETED) 후에도 허용한다. 막으면 완료 후 도착한 메시지의 안읽음 수가
   *   영원히 안 줄어든다.
   */
  markRead: async (userId: string, role: Role, estimateId: string) => {
    await assertAccess(userId, role, estimateId);

    await chatRepository.markRead({ estimateId, readerId: userId });

    // 상대방이 보낸 메시지를 내가 읽었다는 뜻이라, 브로드캐스트는 상대방(발신자)이
    // 자기가 보낸 메시지의 읽음 표시를 실시간으로 갱신하는 데 쓴다.
    broadcastToRoom(estimateId, 'read', { estimateId, readerId: userId });
  },

  /** 채팅 메시지 읽지 않은 개수 조회 */
  getUnreadCount: async (userId: string, role: Role, estimateId: string) => {
    await assertAccess(userId, role, estimateId);

    const unreadCount = await chatRepository.countUnread({
      estimateId,
      readerId: userId,
    });

    return { unreadCount };
  },

  /** 채팅 이미지 업로드 */
  createImageUpload: async (
    userId: string,
    role: Role,
    estimateId: string,
    input: CreateImageUploadInput
  ) => {
    const access = await assertAccess(userId, role, estimateId);
    assertWritable(access);

    return chatRepository.createImageUploadUrl({
      estimateId,
      fileName: input.fileName,
    });
  },
};
