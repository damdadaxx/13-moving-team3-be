/**
 * Auth API 문서.
 * 공통 ErrorResponse 스키마는 src/docs/swagger.ts에 정의되어 있습니다.
 */

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
 *               password: { type: string, minLength: 8, maxLength: 64, description: "숫자·특수문자 각 1개 이상 포함", example: "test1234!" }
 *               name: { type: string }
 *               phoneNumber: { type: string, example: "01012345678" }
 *               role: { type: string, enum: [CUSTOMER, MOVER] }
 *     responses:
 *       201:
 *         description: 가입 성공. `{ success, data }` + accessToken/refreshToken HttpOnly 쿠키
 *       400:
 *         description: 요청 값 검증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: 이미 사용 중인 이메일
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: 요청 횟수 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *       400:
 *         description: 요청 값 검증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 이메일 또는 비밀번호 불일치
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: 요청 횟수 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *         description: 조회 성공. `{ success, data }` 이름/이메일/전화번호 등 기본정보
 *       401:
 *         description: 인증 필요. 만료 시 code는 TOKEN_EXPIRED
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *         description: 수정 성공. `{ success, data }` 수정된 기본정보
 *       400:
 *         description: 요청 값 검증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *               newPassword: { type: string, minLength: 8, maxLength: 64, description: "숫자·특수문자 각 1개 이상 포함", example: "test1234!" }
 *     responses:
 *       200:
 *         description: 변경 성공
 *       400:
 *         description: 요청 값 검증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 필요 또는 현재 비밀번호 불일치
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 소셜 로그인 계정
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: 요청 횟수 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /auth/social/{provider}:
 *   get:
 *     tags: [Auth]
 *     summary: 소셜 로그인 시작 (Passport, 브라우저 이동)
 *     description: >
 *       브라우저가 프론트 프록시(`/api/auth/social/{provider}`)로 이동하면 state 쿠키(`oauthState`)를 설정하고
 *       프로바이더 인가 페이지로 302 한다. Swagger "Try it out" 으로는 흐름을 끝까지 확인할 수 없다.
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema: { type: string, enum: [google, kakao, naver] }
 *       - in: query
 *         name: role
 *         required: true
 *         schema: { type: string, enum: [CUSTOMER, MOVER] }
 *       - in: query
 *         name: callbackUrl
 *         required: false
 *         description: 로그인 후 이동할 프론트 상대 경로 (예 /customer/profile)
 *         schema: { type: string }
 *     responses:
 *       302:
 *         description: >
 *           프로바이더 인가 페이지로 이동.
 *           미설정 프로바이더 / 요청 횟수 초과 시 `{FRONTEND_URL}/auth/callback?error=NOT_CONFIGURED|TOO_MANY_REQUESTS`
 *       400:
 *         description: provider / role / callbackUrl 검증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /auth/social/{provider}/callback:
 *   get:
 *     tags: [Auth]
 *     summary: 소셜 로그인 콜백 (프로바이더가 호출)
 *     description: >
 *       state 쿠키 검증 → Passport 가 code 교환·프로필 조회 → 유저 조회/생성 → accessToken/refreshToken 쿠키 설정 후
 *       프론트 `/auth/callback` 으로 302 한다. 각 콘솔 Redirect URI 는
 *       `{FRONTEND_URL}/api/auth/social/{provider}/callback`.
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema: { type: string, enum: [google, kakao, naver] }
 *       - in: query
 *         name: code
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *     responses:
 *       302:
 *         description: >
 *           성공 `{FRONTEND_URL}/auth/callback?callbackUrl=...` (쿠키 설정) /
 *           실패 `{FRONTEND_URL}/auth/callback?error={CODE}&role={ROLE}`.
 *           CODE: CANCELLED, STATE_MISMATCH, EMAIL_REQUIRED, EMAIL_CONFLICT, SOCIAL_LOGIN_FAILED
 */

export {};
