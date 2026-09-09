/**
 * like 도메인 Swagger 문서입니다.
 * 실제 라우트/컨트롤러/서비스 코드는 src/modules/like에 있고, 이 파일은 @openapi JSDoc만 모아둡니다.
 * 공통 ErrorResponse 스키마는 src/docs/swagger.ts에 정의되어 있습니다.
 *
 * @openapi
 * components:
 *   schemas:
 *     LikedMover:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *           format: uuid
 *         nickname:
 *           type: string
 *           example: 민재 이사센터
 *         imgUrl:
 *           type: string
 *           nullable: true
 *         careerMonths:
 *           type: integer
 *           example: 98
 *         shortIntro:
 *           type: string
 *         description:
 *           type: string
 *         serviceTypes:
 *           type: array
 *           items:
 *             type: string
 *             enum: [SMALL_MOVE, HOME_MOVE, OFFICE_MOVE]
 *     LikedMoverItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: 찜 ID. 단건 삭제 시 path로 전달.
 *         customerId:
 *           type: string
 *           format: uuid
 *         moverId:
 *           type: string
 *           format: uuid
 *         createdAt:
 *           type: string
 *           format: date-time
 *         mover:
 *           $ref: '#/components/schemas/LikedMover'
 *         ratingCount:
 *           type: integer
 *           description: 해당 기사님 리뷰 수
 *         ratingAvg:
 *           type: number
 *           format: float
 *           description: 해당 기사님 평균 평점. 리뷰가 없으면 0.
 *         acceptedEstimateCount:
 *           type: integer
 *           description: 해당 기사님의 확정 견적(ACCEPTED) 수
 *         likeCount:
 *           type: integer
 *           description: 해당 기사님이 받은 전체 찜 수
 *     LikeListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             result:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LikedMoverItem'
 *             nextId:
 *               type: string
 *               format: uuid
 *               description: >
 *                 다음 페이지 요청 시 nextCursorId 쿼리로 그대로 전달.
 *                 더 없으면 필드 자체가 생략됩니다.
 *             likeMoverTotal:
 *               type: integer
 *               description: 로그인한 고객이 찜한 기사 전체 수
 *
 * /likes/me:
 *   get:
 *     tags: [Like]
 *     summary: 내 찜 기사 목록 조회
 *     description: |
 *       로그인한 고객이 찜한 기사 목록입니다. CUSTOMER만 호출할 수 있습니다.
 *       커서 기반이며, 응답 data.nextId를 다음 요청의 nextCursorId로 넘기면 됩니다.
 *       각 항목의 likeCount는 그 기사님이 받은 전체 찜 수입니다.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: nextCursorId
 *         required: false
 *         description: 직전 응답의 data.nextId. 첫 페이지는 생략.
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         required: false
 *         description: 한 번에 가져올 개수
 *         schema:
 *           type: integer
 *           default: 5
 *           minimum: 1
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LikeListResponse'
 *       400:
 *         description: nextCursorId/limit 값이 올바르지 않음 (VALIDATION_ERROR)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 정보 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: CUSTOMER가 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     LikeCountResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             likeCount:
 *               type: integer
 *               description: 해당 기사님이 받은 찜 수
 *               example: 12
 *
 * /likes/{moverId}:
 *   get:
 *     tags: [Like]
 *     summary: 기사님 받은 찜 수 조회
 *     description: 인증 없이 특정 기사님이 받은 찜 개수만 조회합니다.
 *     parameters:
 *       - in: path
 *         name: moverId
 *         required: true
 *         description: 기사님 ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LikeCountResponse'
 *       400:
 *         description: moverId가 uuid 형식이 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     LikeMoverInfoResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             isLiked:
 *               type: boolean
 *               description: 로그인한 고객이 이 기사님을 찜했는지. false도 그대로 내려갑니다.
 *               example: false
 *             likeCount:
 *               type: integer
 *               description: 해당 기사님이 받은 찜 수
 *             likeId:
 *               type: string
 *               format: uuid
 *               description: >
 *                 찜한 경우에만 내려가는 찜 ID. 단건 삭제 path로 사용.
 *                 찜하지 않았으면 필드가 생략됩니다.
 *
 * /likes/me/{moverId}:
 *   get:
 *     tags: [Like]
 *     summary: 내가 이 기사님을 찜했는지 조회
 *     description: |
 *       로그인 고객 기준 찜 여부와 그 기사님의 받은 찜 수를 함께 반환합니다.
 *       CUSTOMER가 아니어도 조회는 가능합니다. 찜 여부는 해당 유저 기준입니다.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: moverId
 *         required: true
 *         description: 기사님 ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LikeMoverInfoResponse'
 *       400:
 *         description: moverId가 uuid 형식이 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 정보 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     LikeSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         customerId:
 *           type: string
 *           format: uuid
 *         moverId:
 *           type: string
 *           format: uuid
 *         createdAt:
 *           type: string
 *           format: date-time
 *     CreateLikeResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             like:
 *               $ref: '#/components/schemas/LikeSummary'
 *             likeCount:
 *               type: integer
 *               description: 찜한 뒤 해당 기사님이 받은 찜 수
 *
 * /likes:
 *   post:
 *     tags: [Like]
 *     summary: 기사님 찜하기
 *     description: |
 *       로그인한 고객이 기사님을 찜합니다. CUSTOMER만 가능하고, 같은 기사는 한 번만 찜할 수 있습니다.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [moverId]
 *             properties:
 *               moverId:
 *                 type: string
 *                 format: uuid
 *                 description: 찜할 기사님 ID
 *           example:
 *             moverId: 10000000-0000-4000-8000-000000000002
 *     responses:
 *       201:
 *         description: 찜 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateLikeResponse'
 *       400:
 *         description: >
 *           code: VALIDATION_ERROR — moverId 검증 실패.
 *           code: BAD_REQUEST — 이미 찜한 기사님.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 정보 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: CUSTOMER가 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     BulkDeleteLikeResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             result:
 *               type: array
 *               description: 삭제한 각 기사님의 남은 찜 수
 *               items:
 *                 type: object
 *                 properties:
 *                   moverId:
 *                     type: string
 *                     format: uuid
 *                   likeCount:
 *                     type: integer
 *
 * /likes/bulk-delete:
 *   post:
 *     tags: [Like]
 *     summary: 찜 여러 개 취소
 *     description: |
 *       찜 ID 배열로 여러 건을 한 번에 취소합니다. 모두 본인 찜이어야 하며,
 *       하나라도 없거나 남의 찜이면 400입니다.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [likeIds]
 *             properties:
 *               likeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *           example:
 *             likeIds:
 *               - 85f02c91-c3cd-4a93-8474-d8608b853ea2
 *     responses:
 *       200:
 *         description: 취소 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkDeleteLikeResponse'
 *       400:
 *         description: >
 *           code: VALIDATION_ERROR — likeIds 검증 실패.
 *           code: BAD_REQUEST — 본인 찜이 아닌 id가 포함됨.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 정보 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: CUSTOMER가 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     DeleteLikeResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             likeCount:
 *               type: integer
 *               description: 취소한 뒤 해당 기사님이 받은 찜 수
 *
 * /likes/{likeId}:
 *   delete:
 *     tags: [Like]
 *     summary: 찜 단건 취소
 *     description: 찜 ID로 한 건을 취소합니다. 본인 찜만 가능합니다.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: likeId
 *         required: true
 *         description: 찜 ID (목록 항목의 id)
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 취소 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteLikeResponse'
 *       400:
 *         description: >
 *           code: VALIDATION_ERROR — likeId가 uuid가 아님.
 *           code: BAD_REQUEST — 찜하지 않은 건이거나 본인 찜이 아님.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 정보 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: CUSTOMER가 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
