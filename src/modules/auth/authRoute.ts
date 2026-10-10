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

/*
@ 이메일 인증번호 발송 — IP 단위 (emailVerificationRateLimit은 계정(이메일+role) 단위)
- 계정 단위 제한만 있으면, 한 IP가 서로 다른 이메일 주소를 계속 바꿔가며 보내는 건 막지 못한다
  (메일 발송 비용·스팸, 가입 여부 응답으로 이메일 존재를 훑는 것 모두 이 경로로 가능하다)
- 두 제한은 서로 다른 것을 막으므로 한쪽으로 합치지 않고 라우트에 같이 건다(AND로 적용)
  - 합쳤다면(예: `ip:email`) 이메일을 하나 바꿀 때마다 새 키가 생겨서,
    계정 단위 제한을 IP 로테이션 없이도 이메일만 바꿔서 우회할 수 있게 된다
- 로그인(loginRateLimit)은 계정 단위만 쓰고 IP 단위가 없다. 로그인은 틀려도 아무 일이
  안 생기지만, 인증번호 발송은 성공하는 순간 메일이 나가 버려 되돌릴 수 없어서 IP
  단위를 추가로 둔다
*/
const emailVerificationIpRateLimit = createRateLimit(TEN_MINUTES_MS, 20, ipKey);

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
  emailVerificationIpRateLimit,
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
