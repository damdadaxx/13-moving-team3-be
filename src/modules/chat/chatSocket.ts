import type { Server, Socket } from 'socket.io';
import { assertAccess } from './chatService';
import { AppError } from '../../utils/error';

type JoinRoomAck = { ok: true } | { ok: false; message: string };

/** 룸 이름 = estimateId. 방 하나에 참여자 둘(고객/기사)뿐이라 네임스페이스 분리 없이
 * estimateId를 그대로 room key로 쓴다.
 */
export const registerChatSocket = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    socket.on(
      'join-room',
      async (estimateId: string, ack?: (res: JoinRoomAck) => void) => {
        try {
          await assertAccess(socket.userId, socket.role, estimateId);
          socket.join(estimateId);
          ack?.({ ok: true });
        } catch (error) {
          const message =
            error instanceof AppError
              ? error.message
              : '채팅방 입장에 실패했습니다.';
          ack?.({ ok: false, message });
        }
      }
    );

    socket.on('leave-room', (estimateId: string) => {
      socket.leave(estimateId);
    });

    // join-room을 통과한 소켓만 자기 estimateId가 socket.rooms에 들어있다 — 그걸로
    // "이 방 참여자 맞는지"를 공짜로 재확인한다. socket.to()는 join 여부와 무관하게
    // 아무 room 이름이나 타겟팅할 수 있어서, 이 체크 없으면 join 안 한 소켓도 아무
    // estimateId로 가짜 typing을 꽂아 넣을 수 있다.
    socket.on('typing', (estimateId: string) => {
      if (!socket.rooms.has(estimateId)) return;
      socket
        .to(estimateId)
        .emit('typing', { estimateId, userId: socket.userId });
    });
  });
};
