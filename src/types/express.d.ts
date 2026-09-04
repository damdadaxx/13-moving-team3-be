import 'express';
import { Role } from '../generated/prisma/client';

declare global {
  namespace Express {
    interface User {
      id: string;
      role: Role;
    }

    interface Request {
      // 이전엔 @types/passport 가 제공하던 타입. passport 제거로 여기서 선언한다.
      user?: User;
      validatedData?: unknown;
    }
  }
}

export {};
