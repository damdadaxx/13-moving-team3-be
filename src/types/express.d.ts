import 'express';
import { JwtPayload } from 'jsonwebtoken';
import { Role } from '../generated/prisma/client';

declare global {
  namespace Express {
    // 이 role: Role은 "authenticate 미들웨어를 전부 통과한 뒤"의 약속이다.
    // JWT를 막 디코딩한 직후에는 role이 Supabase 예약값 'authenticated' 문자열이고
    // 비즈니스 role은 app_role에 있다 — 그 raw 시점 타입은 middlewares/authenticate.ts의
    // DecodedAccessToken을 쓴다. req.auth를 authenticate 없이 직접 디코딩해서 쓰는 코드가
    // 생기면(소켓 핸들러, 테스트 등) 여기 role을 Role로 신뢰하면 안 된다.
    interface AuthPayload extends JwtPayload {
      role: Role;
      app_role?: Role;
    }

    interface Request {
      auth?: AuthPayload;
      validatedData?: unknown;
    }
  }
}

export {};
