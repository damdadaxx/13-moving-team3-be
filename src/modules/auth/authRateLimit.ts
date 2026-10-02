import { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { getClientIp } from '../../utils/clientIp';
import {
  LOGIN_ATTEMPT_WINDOW_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from './authConstants';

/*=================================================
auth 요청 제한 (express-rate-limit)
=================================================*/
/*
@ 가이드
- express-rate-limit 은 errorHandler 를 거치지 않고 자체 429 응답을 보낸다.
  응답 형태는 errorHandler 와 같게 맞춰 둔다
- 저장소는 기본 메모리다. 서버를 재시작하면 카운트가 초기화되고,
  인스턴스를 여러 대로 늘리면 인스턴스마다 따로 센다 (공유하려면 Redis store 필요)
*/
export const rateLimitMessage = {
  success: false,
  error: {
    code: 'TOO_MANY_REQUESTS',
    message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  },
};

export const createRateLimit = (
  windowMs: number,
  limit: number,
  keyGenerator: (req: Request) => string,
  handler?: (req: Request, res: Response) => void,
  options?: { skipSuccessfulRequests?: boolean }
) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: rateLimitMessage,
    ...(handler && { handler }),
    ...options,
  });

// IP 는 프록시가 보낸 실제 사용자 IP (utils/clientIp.ts). ipKeyGenerator 는 IPv6 를 /56 단위로 묶는다
export const ipKey = (req: Request) => ipKeyGenerator(getClientIp(req));

/*
@ 로그인 시도 제한 키 (계정당)
- IP 가 아니라 이메일+role 로 센다. IP 를 바꿔가며 시도해도 같은 계정이면 함께 쌓인다
- 리미터는 validate 앞에서 돌아 body 가 검증 전이므로 방어적으로 정규화한다
- 가입되지 않은 이메일도 같은 규칙으로 센다 (429 가 계정 존재 여부를 알려주지 않게)
*/
export const getLoginRateLimitKey = (req: Request) => {
  const { email, role } = (req.body ?? {}) as Record<string, unknown>;
  const normalizedEmail =
    typeof email === 'string' ? email.trim().toLowerCase().slice(0, 100) : '';
  const normalizedRole = typeof role === 'string' ? role : '';
  return `login:${normalizedRole}:${normalizedEmail}`;
};

/*
@ 로그인 — 계정당 비밀번호 시도 제한
- skipSuccessfulRequests: 성공한 로그인은 세지 않는다 (틀린 횟수만 쌓임)
- 로그인에 성공하면 컨트롤러가 resetLoginRateLimit 으로 카운트를 지운다 → "연속 실패 10회"가 된다
*/
export const loginRateLimit = createRateLimit(
  LOGIN_ATTEMPT_WINDOW_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  getLoginRateLimitKey,
  undefined,
  { skipSuccessfulRequests: true }
);

export const resetLoginRateLimit = (req: Request) => {
  loginRateLimit.resetKey(getLoginRateLimitKey(req));
};

const TEN_MINUTES_MS = 10 * 60 * 1000;

/*
@ 이메일 인증 요청 제한 키 (계정당)
- IP 가 아니라 이메일+role 로 센다. 인증번호 발송·확인 모두 같은 기준을 쓴다
*/
const getEmailVerificationRateLimitKey = (req: Request) => {
  const { email, role } = (req.body ?? {}) as Record<string, unknown>;
  const normalizedEmail =
    typeof email === 'string' ? email.trim().toLowerCase().slice(0, 100) : '';
  const normalizedRole = typeof role === 'string' ? role : '';
  return `email-verification:${normalizedRole}:${normalizedEmail}`;
};

// 이메일 인증번호 발송 — 메일 비용·스팸 방지
export const emailVerificationRateLimit = createRateLimit(
  TEN_MINUTES_MS,
  5,
  getEmailVerificationRateLimitKey
);

/*
@ 인증번호 확인 — 서명 토큰 방식이라 서버가 시도 횟수를 세지 못한다.
   6자리를 찍어 맞히는 것을 막는 방어는 이 rate limit 이 전담한다.
*/
export const confirmEmailRateLimit = createRateLimit(
  TEN_MINUTES_MS,
  10,
  getEmailVerificationRateLimitKey
);
