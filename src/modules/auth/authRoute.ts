import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validation';
import authController, { redirectSocialError } from './authController';
import { createRateLimit, ipKey, loginRateLimit } from './authRateLimit';
import {
  checkEmailSchema,
  loginSchema,
  signupSchema,
  socialStartQuerySchema,
  updateMeSchema,
  updatePasswordSchema,
} from './authValidation';

const router = Router();

const TEN_MINUTES_MS = 10 * 60 * 1000;

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

// 이메일 중복 확인 — 한 IP 에서 이메일을 바꿔가며 가입 여부를 수집하는 것 방지
const checkEmailRateLimit = createRateLimit(TEN_MINUTES_MS, 30, ipKey);

/*
@ 이메일 중복 확인
- 회원가입 화면의 중복 확인 버튼이 사용한다. 가입 전 요청이라 authenticate 를 걸지 않는다.
- POST 인 이유: 이메일이 쿼리스트링·접근 로그에 남지 않게 한다.
*/
router.post(
  '/check-email',
  checkEmailRateLimit,
  validate(checkEmailSchema),
  authController.checkEmail
);

router.post('/signUp', validate(signupSchema), authController.signUp);

/*
@ 로그인 시도 제한
- 계정(이메일+role) 단위다. IP 를 바꿔가며 시도해도 같은 계정이면 함께 센다 (authRateLimit.ts)
- 30분 창에 비밀번호 10회 오류 → 429. 성공하면 컨트롤러가 카운트를 지운다
*/
router.post(
  '/login',
  loginRateLimit,
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
