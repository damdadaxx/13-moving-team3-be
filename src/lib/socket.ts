import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { Role } from '../generated/prisma/client';
import { ACCESS_TOKEN_COOKIE } from '../modules/auth/authConstants';

let io: Server | undefined;

/** "key1=val1; key2=val2" 형태 쿠키 헤더에서 name 값만 꺼낸다.
 * cookie-parser는 Express req에만 붙고 소켓 핸드셰이크엔 안 거치므로 직접 꺼낸다.
 * 외부 쿠키 파서 패키지는 ESM 전용이라 Jest(CJS) 테스트가 깨져서 안 쓴다.
 */
const extractCookieValue = (
  cookieHeader: string | undefined,
  name: string
): string | undefined => {
  if (!cookieHeader) return undefined;

  for (const pair of cookieHeader.split(';')) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) continue;
    if (pair.slice(0, separatorIndex).trim() === name) {
      return decodeURIComponent(pair.slice(separatorIndex + 1).trim());
    }
  }

  return undefined;
};

/** express-jwt를 거치지 않고 소켓 핸드셰이크에서 직접 디코딩한다. */
type SocketAuthPayload = {
  sub: string;
  role?: Role;
};

declare module 'socket.io' {
  interface Socket {
    userId: string;
    role: Role;
  }
}

const socketAuthMiddleware = (
  socket: import('socket.io').Socket,
  next: (err?: Error) => void
) => {
  const token = extractCookieValue(
    socket.handshake.headers.cookie,
    ACCESS_TOKEN_COOKIE
  );

  if (!token) {
    return next(new Error('UNAUTHORIZED'));
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    }) as SocketAuthPayload;

    if (!decoded.sub || !decoded.role) {
      return next(new Error('UNAUTHORIZED'));
    }

    socket.userId = decoded.sub;
    socket.role = decoded.role;
    next();
  } catch {
    next(new Error('UNAUTHORIZED'));
  }
};

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: { origin: ENV.FRONTEND_URL, credentials: true },
  });
  io.use(socketAuthMiddleware);
  return io;
};

/** 실시간 알림은 best-effort다 — 소켓 서버가 아직 안 떴거나(유닛 테스트 등) 꺼져 있어도
 * 메시지 저장 같은 핵심 동작은 항상 성공해야 하므로, 여기서 던지지 않고 조용히 무시한다.
 */
export const broadcastToRoom = (
  room: string,
  event: string,
  payload: unknown
) => {
  io?.to(room).emit(event, payload);
};
