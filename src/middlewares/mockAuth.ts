import { Request, Response, NextFunction } from 'express';
import { Role } from '../generated/prisma/client';
import { ENV } from '../config/env';

/**
 * TEMPORARY — 실제 authenticate 미들웨어가 준비되기 전까지 로컬 테스트용으로만 사용합니다.
 * x-user-id / x-user-role 헤더 값으로 req.user를 채웁니다.
 * authenticate 미들웨어가 merge되면 이 파일과 라우트에 붙인 부분을 반드시 제거해 주세요.
 */
export const mockAuth = (req: Request, _res: Response, next: NextFunction) => {
  if (ENV.NODE_ENV === 'production') return next();

  const userId = req.header('x-user-id');
  const role = req.header('x-user-role');

  if (userId && (role === Role.CUSTOMER || role === Role.MOVER)) {
    req.user = { id: userId, role };
  }

  next();
};
