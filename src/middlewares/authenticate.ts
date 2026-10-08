import { NextFunction, Request, Response } from 'express';
import { expressjwt } from 'express-jwt';
import { JwtPayload } from 'jsonwebtoken';
import { ENV } from '../config/env';
import { Role } from '../generated/prisma/client';
import { ForbiddenError, UnauthorizedError } from '../utils/error';
import { ACCESS_TOKEN_COOKIE } from '../modules/auth/authConstants';

/**
 * access 토큰을 검증해 payload 를 req.auth 에 채운다. (express-jwt)
 *
 * - getToken: 기본값은 Authorization 헤더에서 읽지만, 우리는 토큰을 HttpOnly 쿠키로
 *   내리므로 쿠키에서 꺼낸다.
 * - credentialsRequired 기본값이 true 라서 토큰이 없으면 그대로 401 이 된다.
 * - 실패 시 express-jwt 의 UnauthorizedError(status 401)를 next 로 넘긴다.
 *   공용 errorHandler가 TOKEN_EXPIRED / UNAUTHORIZED 로 변환한다.
 *
 * 인증이 필요한 다른 도메인 라우트에서도 그대로 가져다 쓰면 된다.
 */
const verifyAccessToken = expressjwt({
  secret: ENV.JWT_ACCESS_SECRET,
  algorithms: ['HS256'],
  getToken: (req) => req.cookies?.[ACCESS_TOKEN_COOKIE],
});

/**
 * express-jwt가 req.auth에 채우는 실제 값. role은 아직 Supabase 예약값 'authenticated'고,
 * 비즈니스 role은 app_role에 있다 — Express.AuthPayload(role: Role)처럼 다룰 수 있는
 * 건 applyBusinessRole을 통과한 뒤부터다. 이 타입을 쓰면 decode 직후 시점에서는
 * role이 Role이라고 가정할 수 없다는 게 코드에 드러난다.
 */
type DecodedAccessToken = JwtPayload & {
  role: 'authenticated';
  app_role?: Role;
};

/** JWT의 role claim은 'authenticated' 고정값(Supabase 예약)이라, 비즈니스 role은
 * app_role claim으로 들어온다. 여기서 req.auth.role에 덮어써서 나머지 코드 전체가
 * req.auth.role = CUSTOMER/MOVER 라는 기존 가정을 그대로 쓸 수 있게 한다.
 * app_role이 없으면(이 체계 이전에 발급된 토큰 등) role이 'authenticated'로 남은 채
 * 조용히 넘어가지 않고 바로 401로 끊는다 — 안 그러면 하위 권한 체크들이 원인 불명의
 * 403으로 샌다. */
const applyBusinessRole = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const appRole = (req.auth as DecodedAccessToken | undefined)?.app_role;
  if (!req.auth || !appRole) {
    return next(new UnauthorizedError('토큰이 유효하지 않습니다.'));
  }
  req.auth.role = appRole;
  next();
};

export const authenticate = [verifyAccessToken, applyBusinessRole];

/** authenticate 뒤에 붙인다. CUSTOMER 가 아니면 403. */
export const requireCustomer = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (req.auth?.role !== 'CUSTOMER') {
    return next(new ForbiddenError());
  }
  next();
};
