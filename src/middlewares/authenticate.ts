import { expressjwt } from 'express-jwt';
import { ENV } from '../config/env';
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
export const authenticate = expressjwt({
  secret: ENV.JWT_ACCESS_SECRET,
  algorithms: ['HS256'],
  getToken: (req) => req.cookies?.[ACCESS_TOKEN_COOKIE],
});
