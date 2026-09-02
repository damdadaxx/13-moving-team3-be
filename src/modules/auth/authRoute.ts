import { Router } from 'express';
import { validate } from '../../middlewares/validation';
import * as authController from './authController';
import { authenticate } from './authMiddleware';
import {
  loginSchema,
  providerParamSchema,
  signupSchema,
  socialQuerySchema,
  updateMeSchema,
  updatePasswordSchema,
} from './authValidation';

const router = Router();

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
router.post('/signUp', validate(signupSchema), authController.signUp);

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
router.post('/login', validate(loginSchema), authController.login);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: 로그아웃
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 로그아웃 성공. 쿠키 삭제
 *       401:
 *         description: 인증 필요
 */
router.post('/logout', authenticate, authController.logout);

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
  validate(updatePasswordSchema),
  authController.updatePassword
);

/**
 * @swagger
 * /auth/{provider}/callback:
 *   get:
 *     tags: [Auth]
 *     summary: 소셜 로그인 콜백
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [google, kakao, naver]
 *     responses:
 *       302:
 *         description: 프론트 /auth/callback 으로 리다이렉트
 */
router.get(
  '/:provider/callback',
  validate(providerParamSchema, 'params'),
  authController.oauthCallback
);

/**
 * @swagger
 * /auth/{provider}:
 *   get:
 *     tags: [Auth]
 *     summary: 소셜 로그인 시작
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [google, kakao, naver]
 *       - in: query
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *           enum: [CUSTOMER, MOVER]
 *     responses:
 *       302:
 *         description: 소셜 제공자 로그인 페이지로 리다이렉트
 */
router.get(
  '/:provider',
  validate(providerParamSchema, 'params'),
  validate(socialQuerySchema, 'query'),
  authController.startOAuth
);

export default router;
