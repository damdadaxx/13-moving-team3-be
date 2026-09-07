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
 *         description: 가입 성공. `{ success, data }` + accessToken/refreshToken HttpOnly 쿠키
 *       409:
 *         description: 이미 사용 중인 이메일
 */

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
 *         description: 로그인 성공. `{ success, data }` + accessToken/refreshToken HttpOnly 쿠키
 *       401:
 *         description: 이메일 또는 비밀번호 불일치
 */

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

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: accessToken 재발급
 *     description: refreshToken 쿠키로 새 토큰 쌍을 발급합니다.
 *     responses:
 *       200:
 *         description: 재발급 성공. `{ success, data }` 유저 정보
 *       401:
 *         description: 리프레시 토큰 없음/만료/불일치
 */

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
 *         description: `{ success, data }` 이름/이메일/전화번호 등 기본정보
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
 *         description: `{ success, data }` 수정된 기본정보
 *       401:
 *         description: 인증 필요
 */

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
 *         description: 로그인 성공. `{ success, data }` + 쿠키 설정
 *       400:
 *         description: code 교환 실패 / redirectUri 불일치 / 검증 실패
 *       409:
 *         description: 이미 사용 중인 이메일
 *       503:
 *         description: 해당 소셜 로그인 미설정
 */

export {};
