/**
 * Customer Profile API 문서.
 * 공통 ErrorResponse 스키마는 src/docs/swagger.ts에 정의되어 있습니다.
 */

/**
 * @swagger
 * /customer/profile:
 *   post:
 *     tags: [Customer]
 *     summary: 고객 프로필 최초 등록
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [region, serviceTypes]
 *             properties:
 *               region:
 *                 type: string
 *                 enum: [SEOUL, GYEONGGI, INCHEON, GANGWON, CHUNGBUK, CHUNGNAM, SEJONG, DAEJEON, JEONBUK, JEONNAM, GWANGJU, GYEONGBUK, GYEONGNAM, DAEGU, ULSAN, BUSAN, JEJU]
 *               serviceTypes:
 *                 type: string
 *                 description: 'JSON 배열 문자열. 예 ["HOME_MOVE","OFFICE_MOVE"]'
 *               profileImage:
 *                 type: string
 *                 format: binary
 *                 description: 프로필 이미지. jpeg/png/webp, 5MB 이하
 *         application/json:
 *           schema:
 *             type: object
 *             required: [region, serviceTypes]
 *             properties:
 *               region:
 *                 type: string
 *                 enum: [SEOUL, GYEONGGI, INCHEON, GANGWON, CHUNGBUK, CHUNGNAM, SEJONG, DAEJEON, JEONBUK, JEONNAM, GWANGJU, GYEONGBUK, GYEONGNAM, DAEGU, ULSAN, BUSAN, JEJU]
 *               serviceTypes:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   enum: [SMALL_MOVE, HOME_MOVE, OFFICE_MOVE]
 *     responses:
 *       201:
 *         description: 등록 성공. `{ success, data }`
 *       400:
 *         description: region / serviceTypes 검증 실패
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
 *       403:
 *         description: MOVER 계정
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: 이미 등록된 프로필
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     tags: [Customer]
 *     summary: 내 프로필 조회
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 조회 성공. `{ success, data }` User 기본정보 + 프로필
 *       401:
 *         description: 인증 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: MOVER 계정
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 프로필 미등록
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   patch:
 *     tags: [Customer]
 *     summary: 내 프로필 수정
 *     description: region/serviceTypes 는 필수. serviceTypes 는 전체 교체. profileImage를 보내면 기존 로컬 파일을 교체한다. name/phoneNumber 는 PATCH /auth/me.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [region, serviceTypes]
 *             properties:
 *               region:
 *                 type: string
 *                 enum: [SEOUL, GYEONGGI, INCHEON, GANGWON, CHUNGBUK, CHUNGNAM, SEJONG, DAEJEON, JEONBUK, JEONNAM, GWANGJU, GYEONGBUK, GYEONGNAM, DAEGU, ULSAN, BUSAN, JEJU]
 *               serviceTypes:
 *                 type: string
 *                 description: 'JSON 배열 문자열. 예 ["SMALL_MOVE"]'
 *               profileImage:
 *                 type: string
 *                 format: binary
 *                 description: 보낼 때만 이미지를 교체한다
 *         application/json:
 *           schema:
 *             type: object
 *             required: [region, serviceTypes]
 *             properties:
 *               region:
 *                 type: string
 *                 enum: [SEOUL, GYEONGGI, INCHEON, GANGWON, CHUNGBUK, CHUNGNAM, SEJONG, DAEJEON, JEONBUK, JEONNAM, GWANGJU, GYEONGBUK, GYEONGNAM, DAEGU, ULSAN, BUSAN, JEJU]
 *               serviceTypes:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   enum: [SMALL_MOVE, HOME_MOVE, OFFICE_MOVE]
 *     responses:
 *       200:
 *         description: 수정 성공. `{ success, data }` 수정된 프로필
 *       400:
 *         description: region / serviceTypes 검증 실패
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
 *       403:
 *         description: MOVER 계정
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 프로필 미등록
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

export {};
