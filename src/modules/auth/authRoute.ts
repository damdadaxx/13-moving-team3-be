import { Request, Response, Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validation';
import { getClientIp } from '../../utils/clientIp';
import authController, { redirectSocialError } from './authController';
import {
  loginSchema,
  signupSchema,
  socialStartQuerySchema,
  updateMeSchema,
  updatePasswordSchema,
} from './authValidation';

const router = Router();

// express-rate-limit 은 errorHandler를 거치지 않고 자체 429 응답한다.
const rateLimitMessage = {
  success: false,
  error: {
    code: 'TOO_MANY_REQUESTS',
    message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  },
};

const TEN_MINUTES_MS = 10 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

const createRateLimit = (
  windowMs: number,
  limit: number,
  keyGenerator: (req: Request) => string,
  handler?: (req: Request, res: Response) => void
) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: rateLimitMessage,
    ...(handler && { handler }),
  });

/*
@ 키
- IP 는 프록시가 보낸 실제 사용자 IP (utils/clientIp.ts). ipKeyGenerator 는 IPv6 를 /56 단위로 묶는다
- 리미터는 validate 앞에서 돌아 body 가 검증 전이므로 email 은 방어적으로 정규화한다
*/
const ipKey = (req: Request) => ipKeyGenerator(getClientIp(req));

const emailKey = (req: Request) => {
  const email: unknown = req.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

// 로그인 — 이메일+IP 단위로 브루트포스 방어.
// 공유 IP(회사/학교 NAT)에서 다른 계정 사용자까지 함께 잠기지 않는다.
const loginEmailRateLimit = createRateLimit(
  TEN_MINUTES_MS,
  10,
  (req) => `${ipKey(req)}:${emailKey(req)}`
);

// 로그인 — 한 IP 에서 이메일을 바꿔가며 시도하는 크리덴셜 스터핑 상한
const loginIpRateLimit = createRateLimit(TEN_MINUTES_MS, 100, ipKey);

// 소셜 로그인 시작 — IP 단위. 브라우저 이동 흐름이라 429 JSON 대신 프론트 안내 페이지로 보낸다
const socialRateLimit = createRateLimit(
  TEN_MINUTES_MS,
  30,
  ipKey,
  (_req, res) => redirectSocialError(res, 'TOO_MANY_REQUESTS')
);

// 비밀번호 변경 — authenticate 뒤에 붙으므로 유저 단위
const passwordRateLimit = createRateLimit(TEN_MINUTES_MS, 10, (req) =>
  req.auth?.sub ? `user:${req.auth.sub}` : ipKey(req)
);

// 회원가입 — 대량 계정 생성 방어
const signupRateLimit = createRateLimit(ONE_HOUR_MS, 5, ipKey);

router.post(
  '/signUp',
  signupRateLimit,
  validate(signupSchema),
  authController.signUp
);

router.post(
  '/login',
  loginIpRateLimit,
  loginEmailRateLimit,
  validate(loginSchema),
  authController.login
);

// authenticate를 걸지 않는다: access 토큰이 만료돼도 로그아웃은 항상 성공해야 하며,
// 서버 refreshToken 정리는 refresh 쿠키(+해시 일치)로 인가한다.
router.post('/logout', authController.logout);

router.post('/refresh', authController.refresh);

router.get('/me', authenticate, authController.getMe);
router.patch(
  '/me',
  authenticate,
  validate(updateMeSchema),
  authController.updateMe
);

router.patch(
  '/password',
  authenticate,
  passwordRateLimit,
  validate(updatePasswordSchema),
  authController.updatePassword
);

/*
@ 소셜 로그인 (Passport)
- 브라우저가 프론트 프록시(/api/auth/social/...)를 통해 직접 이동하는 GET 흐름이다
- :provider 는 컨트롤러에서 providerParamSchema 로 검증한다 (validate 는 query 를 담는다)
*/
router.get(
  '/social/:provider',
  socialRateLimit,
  validate(socialStartQuerySchema, 'query'),
  authController.startSocialLogin
);

router.get('/social/:provider/callback', authController.socialLoginCallback);

export default router;
