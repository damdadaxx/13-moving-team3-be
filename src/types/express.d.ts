import 'express';
import { JwtPayload } from 'jsonwebtoken';
import { Role } from '../generated/prisma/client';

declare global {
  namespace Express {
    interface AuthPayload extends JwtPayload {
      role: Role;
    }

    interface Request {
      auth?: AuthPayload;
      validatedData?: unknown;
      // TODO: auth 미들웨어 구현 후 실제로 세팅됩니다. 그 전까지 아래 라우트들은 req.user가 없다고 가정하고 401을 반환합니다.
      user?: {
        id: string;
        role: Role;
      };
    }
  }
}

export {};
