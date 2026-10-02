import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validation';
import authController, { redirectSocialError } from './authController';
import {
  confirmEmailRateLimit,
  createRateLimit,
  emailVerificationRateLimit,
  ipKey,
  loginRateLimit,
} from './authRateLimit';
import {
  confirmEmailSchema,
  loginSchema,
  sendEmailCodeSchema,
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

router.post('/signUp', validate(signupSchema), authController.signUp);

/*
@ 회원가입 이메일 인증
- 발송: 가입되지 않은 이메일에만 인증번호를 보낸다.
- 확인: 인증에 성공하면 회원가입에서 그 기록을 확인한다.
*/
router.post(
  '/email-verification',
  emailVerificationRateLimit,
  validate(sendEmailCodeSchema),
  authController.sendEmailVerification
);

router.post(
  '/email-verification/confirm',
  confirmEmailRateLimit,
  validate(confirmEmailSchema),
  authController.confirmEmailVerification
);

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
