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
 *         application/json:
 *           schema:
 *             type: object
 *             required: [region, serviceTypes]
 *             properties:
 *               imgUrl: { type: string, format: uri, nullable: true }
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
 *       403:
 *         description: MOVER 계정
 *       409:
 *         description: 이미 등록된 프로필
 *   get:
 *     tags: [Customer]
 *     summary: 내 프로필 조회
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: `{ success, data }` User 기본정보 + 프로필
 *       401:
 *         description: 인증 필요
 *       404:
 *         description: 프로필 미등록
 *   patch:
 *     tags: [Customer]
 *     summary: 내 프로필 수정
 *     description: region/serviceTypes 는 필수. serviceTypes 는 전체 교체. name/phoneNumber 는 PATCH /auth/me.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [region, serviceTypes]
 *             properties:
 *               imgUrl: { type: string, format: uri, nullable: true }
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
 *         description: `{ success, data }` 수정된 프로필
 *       400:
 *         description: region / serviceTypes 검증 실패
 *       404:
 *         description: 프로필 미등록
 */

export {};
