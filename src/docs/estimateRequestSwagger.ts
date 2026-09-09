/**
 * @swagger
 * components:
 *   schemas:
 *     MoverSummary:
 *       type: object
 *       description: 견적을 보낸 기사님 정보와 집계값
 *       properties:
 *         userId: { type: string, format: uuid, description: 기사님 식별자. 상세 이동·찜 토글에 사용 }
 *         nickname: { type: string, example: "하늘 프리미엄무빙" }
 *         imgUrl: { type: string, nullable: true }
 *         careerMonths: { type: integer, example: 182 }
 *         user:
 *           type: object
 *           properties:
 *             name: { type: string, example: "정하늘" }
 *         reviewCount: { type: integer, example: 3, description: 받은 리뷰 총 개수 }
 *         averageRating:
 *           type: number
 *           nullable: true
 *           example: 4.7
 *           description: 평점 평균(소수점 첫째 자리 반올림). 리뷰가 없으면 null (0이 아님)
 *         confirmedEstimateCount:
 *           type: integer
 *           example: 3
 *           description: 확정(ACCEPTED)받은 견적의 누적 총 건수. 이 요청 한정이 아님
 *         likeCount: { type: integer, example: 4, description: 찜 받은 수 }
 *
 *     EstimateSummary:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         price:
 *           type: integer
 *           nullable: true
 *           example: 310000
 *           description: 금액 미입력(DESIGNATED)·반려(REJECTED) 건은 null
 *         comment: { type: string, nullable: true }
 *         isDesignated: { type: boolean, description: 고객이 기사님을 지정해 요청한 견적인지 }
 *         status:
 *           type: string
 *           enum: [PROPOSED, DESIGNATED, REJECTED, ACCEPTED, NOT_SELECTED, EXPIRED]
 *         rejectReason: { type: string, nullable: true, description: 지정 견적 반려 사유 }
 *         mover: { $ref: '#/components/schemas/MoverSummary' }
 *
 *     EstimateRequestDetail:
 *       type: object
 *       description: 견적 요청 1건과 받은 견적 목록. 견적은 생성 최신순
 *       properties:
 *         id: { type: string, format: uuid }
 *         customerId: { type: string, format: uuid }
 *         serviceType: { type: string, enum: [SMALL_MOVE, HOME_MOVE, OFFICE_MOVE] }
 *         moveDate: { type: string, format: date-time }
 *         departureAddress: { type: string }
 *         arrivalAddress: { type: string }
 *         status: { type: string, enum: [PENDING, CONFIRMED, COMPLETED, EXPIRED] }
 *         estimates:
 *           type: array
 *           items: { $ref: '#/components/schemas/EstimateSummary' }
 *
 *     ValidationErrorResponse:
 *       type: object
 *       properties:
 *         path: { type: string }
 *         method: { type: string }
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field: { type: string, example: "limit" }
 *               message: { type: string, example: "limit은 50 이하여야 합니다." }
 *         date: { type: string, format: date-time }
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         path: { type: string }
 *         method: { type: string }
 *         message: { type: string, example: "이미 진행 중인 견적 요청이 있습니다." }
 *         date: { type: string, format: date-time }
 */

/**
 * @swagger
 * /estimate-requests:
 *   post:
 *     tags: [EstimateRequest]
 *     summary: 견적 요청 생성
 *     description: |
 *       진행 중인 견적 요청을 생성한다. 생성과 동시에 `customerProfile.activeEstimateRequestId`가 연결된다.
 *       고객당 진행 중(PENDING/CONFIRMED)인 요청은 부분 유니크 인덱스로 1건만 허용된다.
 *
 *       우편번호는 5자리 문자열이다. "04524"처럼 0으로 시작하는 번호를 보존하기 위해 숫자가 아닌 문자열로 받는다.
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               [
 *                 serviceType,
 *                 moveDate,
 *                 departureZipCode,
 *                 departureAddress,
 *                 arrivalZipCode,
 *                 arrivalAddress,
 *               ]
 *             properties:
 *               serviceType: { type: string, enum: [SMALL_MOVE, HOME_MOVE, OFFICE_MOVE] }
 *               moveDate:
 *                 { type: string, format: date-time, description: 오늘 이후 날짜만 허용 }
 *               departureZipCode:
 *                 { type: string, pattern: '^\d{5}$', example: "21556" }
 *               departureAddress:
 *                 { type: string, minLength: 5, maxLength: 200, example: "인천광역시 남동구 예술로 149 201동 1102호" }
 *               arrivalZipCode:
 *                 { type: string, pattern: '^\d{5}$', example: "06035" }
 *               arrivalAddress:
 *                 { type: string, minLength: 5, maxLength: 200, example: "서울특별시 강남구 가로수길 5 201호" }
 *     responses:
 *       201:
 *         description: 생성 성공. 생성 직후라 `estimates`는 빈 배열이고 `status`는 PENDING
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/EstimateRequestDetail' }
 *             example:
 *               success: true
 *               data:
 *                 id: c25b7b42-d6aa-4ed0-98ff-fe71461b372c
 *                 customerId: 20000000-0000-4000-8000-000000000003
 *                 serviceType: HOME_MOVE
 *                 moveDate: 2026-11-20T00:00:00.000Z
 *                 departureAddress: 인천광역시 남동구 예술로 149 201동 1102호
 *                 arrivalAddress: 서울특별시 강남구 가로수길 5 201호
 *                 status: PENDING
 *                 estimates: []
 *       400:
 *         description: 검증 실패 (이사일이 과거, serviceType 오류 등)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrorResponse' }
 *       403:
 *         description: MOVER 토큰으로 호출
 *       409:
 *         description: 이미 진행 중인 견적 요청이 있음
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */

/**
 * @swagger
 * /estimate-requests/active:
 *   get:
 *     tags: [EstimateRequest]
 *     summary: 진행 중인 견적 요청 + 받은 견적 목록
 *     description: |
 *       로그인한 고객의 진행 중(PENDING/CONFIRMED) 요청을 받은 견적과 함께 반환한다.
 *       고객당 활성 요청은 최대 1건이 DB로 보장되므로 경로에 id를 받지 않는다.
 *
 *       진행 중인 요청이 없으면 404가 아니라 `200 { success: true, data: null }`이다.
 *       아직 요청하지 않은 고객은 오류가 아니라 정상적인 빈 상태이기 때문이다.
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200:
 *         description: 조회 성공. 진행 중인 요청이 없으면 `data`가 null
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   allOf: [{ $ref: '#/components/schemas/EstimateRequestDetail' }]
 *                   nullable: true
 *             example:
 *               success: true
 *               data:
 *                 id: c25b7b42-d6aa-4ed0-98ff-fe71461b372c
 *                 customerId: 20000000-0000-4000-8000-000000000003
 *                 serviceType: HOME_MOVE
 *                 moveDate: 2026-11-20T00:00:00.000Z
 *                 departureAddress: 인천광역시 남동구 예술로 149 201동 1102호
 *                 arrivalAddress: 서울특별시 강남구 가로수길 5 201호
 *                 status: PENDING
 *                 estimates:
 *                   - id: 91b4e06c-6b02-4f3a-8fc9-b17ccb9e3c32
 *                     price: null
 *                     comment: null
 *                     isDesignated: true
 *                     status: DESIGNATED
 *                     rejectReason: null
 *                     mover:
 *                       userId: 10000000-0000-4000-8000-000000000005
 *                       nickname: 하늘 프리미엄무빙
 *                       imgUrl: https://picsum.photos/seed/mover-haneul/240/240
 *                       careerMonths: 182
 *                       user: { name: 정하늘 }
 *                       reviewCount: 3
 *                       averageRating: 4.7
 *                       confirmedEstimateCount: 3
 *                       likeCount: 4
 *       403:
 *         description: MOVER 토큰으로 호출
 */

/**
 * @swagger
 * /estimate-requests/history:
 *   get:
 *     tags: [EstimateRequest]
 *     summary: 이사 이력 목록 (커서 기반 무한 스크롤)
 *     description: |
 *       이사일이 지난 요청(COMPLETED/EXPIRED)만 최신순으로 반환한다. 진행 중인 요청은 `/estimate-requests/active`가 담당한다.
 *
 *       페이지 순회: `hasNext`가 true면 `nextCursor`를 다음 요청의 `cursor`로 넘긴다. 마지막 페이지에서는 `nextCursor`가 null이다.
 *       내부적으로 `limit + 1`건을 읽어 다음 페이지 유무를 판별하므로 별도 count 쿼리가 없다.
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema: { type: string, format: uuid }
 *         description: 직전 페이지 마지막 요청의 id. 첫 페이지는 생략
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 4 }
 *         description: 페이지 크기
 *     responses:
 *       200:
 *         description: 조회 성공. 이력이 없으면 `items`는 빈 배열
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/EstimateRequestDetail' }
 *                     nextCursor:
 *                       { type: string, format: uuid, nullable: true, description: 마지막 페이지에서는 null }
 *                     hasNext: { type: boolean }
 *             example:
 *               success: true
 *               data:
 *                 items:
 *                   - id: 30000000-0000-4000-8000-000000000006
 *                     customerId: 20000000-0000-4000-8000-000000000001
 *                     serviceType: SMALL_MOVE
 *                     moveDate: 2026-05-07T09:23:55.073Z
 *                     departureAddress: 서울특별시 서대문구 연희로 25 401호
 *                     arrivalAddress: 서울특별시 중구 세종대로 110 3층
 *                     status: COMPLETED
 *                     estimates:
 *                       - id: 40000000-0000-4000-8000-000000000013
 *                         price: 260000
 *                         comment: 짐이 많지 않아 1톤 차량으로 충분합니다.
 *                         isDesignated: false
 *                         status: ACCEPTED
 *                         rejectReason: null
 *                         mover:
 *                           userId: 10000000-0000-4000-8000-000000000001
 *                           nickname: 민재 이사센터
 *                           imgUrl: https://picsum.photos/seed/mover-minjae/240/240
 *                           careerMonths: 98
 *                           user: { name: 김민재 }
 *                           reviewCount: 1
 *                           averageRating: 5
 *                           confirmedEstimateCount: 2
 *                           likeCount: 2
 *                 nextCursor: 30000000-0000-4000-8000-000000000006
 *                 hasNext: true
 *       400:
 *         description: cursor 형식 오류 / limit 범위 초과
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrorResponse' }
 *       403:
 *         description: MOVER 토큰으로 호출
 */

/**
 * @swagger
 * /estimate-requests/{estimateRequestId}/estimates:
 *   post:
 *     tags: [EstimateRequest]
 *     summary: 지정 견적 요청
 *     description: |
 *       특정 기사님을 지정해 견적을 요청한다. 요청 1건당 최대 3명까지 지정할 수 있다.
 *       생성되는 견적은 `isDesignated: true`, `status: DESIGNATED`, `price: null`로 고정되고 금액은 기사님이 나중에 채운다.
 *
 *       주의: 반려(REJECTED)된 지정 견적도 3건에 포함되며, 반려한 기사님에게는 재요청할 수 없다(유니크 제약).
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: estimateRequestId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: 본인의 진행 중(PENDING)인 요청 id
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
 *                 description: 지정할 기사님의 userId
 *                 example: 10000000-0000-4000-8000-000000000005
 *     responses:
 *       201:
 *         description: 지정 견적 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     isDesignated: { type: boolean, example: true }
 *                     status: { type: string, example: DESIGNATED }
 *                     mover:
 *                       type: object
 *                       properties:
 *                         userId: { type: string, format: uuid }
 *                         nickname: { type: string }
 *                         user:
 *                           type: object
 *                           properties:
 *                             name: { type: string }
 *             example:
 *               success: true
 *               data:
 *                 id: 91b4e06c-6b02-4f3a-8fc9-b17ccb9e3c32
 *                 isDesignated: true
 *                 status: DESIGNATED
 *                 mover:
 *                   userId: 10000000-0000-4000-8000-000000000005
 *                   nickname: 하늘 프리미엄무빙
 *                   user: { name: 정하늘 }
 *       400:
 *         description: uuid 형식 오류 / 이미 확정된(CONFIRMED) 요청
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrorResponse' }
 *       403:
 *         description: 본인의 견적 요청이 아님 / MOVER 토큰으로 호출
 *       404:
 *         description: 진행 중인 견적 요청이 없음 / moverId에 해당하는 기사님이 없음
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       409:
 *         description: 이미 지정 견적을 요청한 기사님 / 지정 견적 3건 상한 초과
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */

export {};
