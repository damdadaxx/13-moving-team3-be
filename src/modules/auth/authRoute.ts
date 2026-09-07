import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validation';
import * as authController from './authController';
import {
  loginSchema,
  signupSchema,
  socialAuthSchema,
  updateMeSchema,
  updatePasswordSchema,
} from './authValidation';

const router = Router();

// express-rate-limit 은 errorHandler를 거치지 않고 자체 429 응답한다.
const rateLimitMessage = {
  success: false,
  message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  code: 'TOO_MANY_REQUESTS',
};

// TODO: 기본 keyGenerator 가 IP 만 사용. 공유 IP(회사/학교 NAT)에서 무고한 사용자가 함께 잠길 수 있음. 여유되면 email+IP 조합 키로 변경.
// TODO: 배포 시 app.set('trust proxy', ...) 없으면 모든 요청이 프록시 IP 로 잡혀
//   전원 같은 버킷 → 즉시 429 + ValidationError. (app.ts 참고)
// 로그인 / 비밀번호 변경 / 소셜 — 자격 증명 브루트포스 방어
const loginRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10, // IP당 10분에 10회
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitMessage,
});

// 회원가입 — 대량 계정 생성 방어
const signupRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5, // IP당 1시간에 5회
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitMessage,
});

router.post(
  '/signUp',
  signupRateLimit,
  validate(signupSchema),
  authController.signUp
);

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
  loginRateLimit,
  validate(updatePasswordSchema),
  authController.updatePassword
);

// 공용 validate 는 req.validatedData 를 덮어써서 params + body 를 같이 담지 못한다.
// :provider 는 컨트롤러에서 providerParamSchema 로 직접 검증한다.
router.post(
  '/social/:provider',
  loginRateLimit,
  validate(socialAuthSchema),
  authController.socialLogin
);

// auth 응답만 { success, data } / { success, message, code } 로 통일한다.
// 공용 errorHandler(app.ts)까지 가기 전에 여기서 끝낸다.
router.use(authController.errorHandler);

export default router;
