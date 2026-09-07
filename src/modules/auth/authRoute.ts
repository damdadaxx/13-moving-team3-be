import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from './authController';
import { authenticate, validate } from './authMiddleware';
import {
  loginSchema,
  providerParamSchema,
  signupSchema,
  socialAuthSchema,
  updateMeSchema,
  updatePasswordSchema,
} from './authValidation';

const router = Router();

// express-rate-limit 은 errorHandler를 거치지 않고 자체 429 응답한다.
const rateLimitMessage = {
  success: false,
  data: null,
  message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
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

/**
 * @swagger
 * /auth/signUp:
 *   post:
 *     tags: [Auth]
 *     summary: 회원가입
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name, phoneNumber, role]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               name: { type: string }
 *               phoneNumber: { type: string, example: "01012345678" }
 *               role: { type: string, enum: [CUSTOMER, MOVER] }
 *     responses:
 *       201:
 *         description: 가입 성공. accessToken/refreshToken HttpOnly 쿠키 설정
 *       409:
 *         description: 이미 사용 중인 이메일
 */
router.post(
  '/signUp',
  signupRateLimit,
  validate(signupSchema),
  authController.signUp
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: 로그인
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, role]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               role: { type: string, enum: [CUSTOMER, MOVER] }
 *     responses:
 *       200:
 *         description: 로그인 성공. accessToken/refreshToken HttpOnly 쿠키 설정
 *       401:
 *         description: 이메일 또는 비밀번호 불일치
 */
router.post(
  '/login',
  loginRateLimit,
  validate(loginSchema),
  authController.login
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: 로그아웃
 *     description: 인증 불필요. refresh 쿠키가 있으면 서버 refreshToken도 정리하고, 없어도 쿠키를 삭제하고 200을 반환한다.
 *     responses:
 *       200:
 *         description: 로그아웃 성공. accessToken/refreshToken 쿠키 삭제
 */
// authenticate를 걸지 않는다: access 토큰이 만료돼도 로그아웃은 항상 성공해야 하며,
// 서버 refreshToken 정리는 refresh 쿠키(+해시 일치)로 인가한다.
router.post('/logout', authController.logout);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: accessToken 재발급
 *     description: refreshToken 쿠키로 새 토큰 쌍을 발급합니다.
 *     responses:
 *       200:
 *         description: 재발급 성공
 *       401:
 *         description: 리프레시 토큰 없음/만료/불일치
 */
router.post('/refresh', authController.refresh);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: 내 기본정보 조회
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 이름/이메일/전화번호 등 기본정보
 *       401:
 *         description: 인증 필요
 *   patch:
 *     tags: [Auth]
 *     summary: 내 기본정보 수정
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               phoneNumber: { type: string }
 *     responses:
 *       200:
 *         description: 수정된 기본정보
 *       401:
 *         description: 인증 필요
 */
router.get('/me', authenticate, authController.getMe);
router.patch(
  '/me',
  authenticate,
  validate(updateMeSchema),
  authController.updateMe
);

/**
 * @swagger
 * /auth/password:
 *   patch:
 *     tags: [Auth]
 *     summary: 비밀번호 변경
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: 변경 성공
 *       403:
 *         description: 소셜 로그인 계정
 */
router.patch(
  '/password',
  authenticate,
  loginRateLimit,
  validate(updatePasswordSchema),
  authController.updatePassword
);

/**
 * @swagger
 * /auth/social/{provider}:
 *   post:
 *     tags: [Auth]
 *     summary: 소셜 로그인 (프론트 릴레이)
 *     description: >
 *       프론트가 프로바이더 authorize 후 받은 code 를 전달하면, 백엔드가 code→token→프로필
 *       교환 후 accessToken/refreshToken 쿠키를 설정한다. redirect_uri 는 프론트 소유.
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema: { type: string, enum: [google, kakao, naver] }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, redirectUri, role]
 *             properties:
 *               code: { type: string }
 *               redirectUri: { type: string, description: 프론트가 authorize 에 쓴 redirect_uri }
 *               state: { type: string, description: 네이버 필수 }
 *               role: { type: string, enum: [CUSTOMER, MOVER] }
 *     responses:
 *       200:
 *         description: 로그인 성공. 쿠키 설정
 *       400:
 *         description: code 교환 실패 / redirectUri 불일치 / 검증 실패
 *       409:
 *         description: 이미 사용 중인 이메일
 *       503:
 *         description: 해당 소셜 로그인 미설정
 */
router.post(
  '/social/:provider',
  loginRateLimit,
  validate(providerParamSchema, 'params'),
  validate(socialAuthSchema),
  authController.socialLogin
);

export default router;
