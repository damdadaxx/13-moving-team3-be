/**
 * review 도메인 Swagger 문서입니다.
 * 실제 라우트/컨트롤러/서비스 코드는 src/modules/review에 있고, 이 파일은 @openapi JSDoc만 모아둡니다.
 * 공통 ErrorResponse 스키마는 src/docs/swagger.ts에 정의되어 있습니다.
 *
 * @openapi
 * components:
 *   schemas:
 *     ReviewMoverSummary:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *           format: uuid
 *         imgUrl:
 *           type: string
 *           nullable: true
 *         nickname:
 *           type: string
 *           example: 민재 이사센터
 *         shortIntro:
 *           type: string
 *           nullable: true
 *     ReviewEstimateRequestSummary:
 *       type: object
 *       properties:
 *         customerId:
 *           type: string
 *           format: uuid
 *         serviceType:
 *           type: string
 *           enum: [SMALL_MOVE, HOME_MOVE, OFFICE_MOVE]
 *         departureAddress:
 *           type: string
 *         arrivalAddress:
 *           type: string
 *         moveDate:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [PENDING, CONFIRMED, COMPLETED, EXPIRED]
 *     ReviewSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         estimateId:
 *           type: string
 *           format: uuid
 *         customerId:
 *           type: string
 *           format: uuid
 *         moverId:
 *           type: string
 *           format: uuid
 *         rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         content:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     MyReviewEstimateItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: 견적 ID
 *         price:
 *           type: integer
 *           nullable: true
 *           example: 310000
 *         mover:
 *           $ref: '#/components/schemas/ReviewMoverSummary'
 *         estimateRequest:
 *           $ref: '#/components/schemas/ReviewEstimateRequestSummary'
 *         review:
 *           allOf:
 *             - $ref: '#/components/schemas/ReviewSummary'
 *           nullable: true
 *           description: 작성된 리뷰. 없으면 null.
 *     MyReviewListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             list:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MyReviewEstimateItem'
 *             totalPages:
 *               type: integer
 *               description: 전체 페이지 수
 *
 * /reviews/me:
 *   get:
 *     tags: [Review]
 *     summary: 내 완료 견적 목록 조회 (리뷰 작성/미작성)
 *     description: |
 *       로그인한 고객의 이사 완료(COMPLETED) 견적만 조회합니다.
 *       hasReview=true 이면 리뷰를 이미 작성한 견적만,
 *       false 이거나 생략하면 아직 리뷰를 쓰지 않은 견적만 반환합니다.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         description: 페이지 번호
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *       - in: query
 *         name: pageSize
 *         required: false
 *         description: 한 페이지당 견적 개수
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *       - in: query
 *         name: hasReview
 *         required: false
 *         description: >
 *           리뷰 작성 여부 필터.
 *           true=작성 완료, false 또는 생략=미작성.
 *         schema:
 *           type: string
 *           enum: [true, false]
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MyReviewListResponse'
 *       400:
 *         description: page/pageSize/hasReview 값이 올바르지 않음 (VALIDATION_ERROR)
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
 *     RatingDistributionItem:
 *       type: object
 *       properties:
 *         rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         count:
 *           type: integer
 *     MoverReviewListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             list:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ReviewSummary'
 *             ratingDistribution:
 *               type: array
 *               description: 점수별 리뷰 개수
 *               items:
 *                 $ref: '#/components/schemas/RatingDistributionItem'
 *             ratingAvg:
 *               type: number
 *               format: float
 *               description: 평균 평점. 리뷰가 없으면 0.
 *             reviewCount:
 *               type: integer
 *               description: 총 리뷰 수
 *             totalPages:
 *               type: integer
 *               description: 전체 페이지 수
 *
 * /reviews/mover/{moverId}:
 *   get:
 *     tags: [Review]
 *     summary: 기사님 리뷰 목록 조회
 *     description: |
 *       특정 기사님의 리뷰 목록과 평점 통계를 조회합니다.
 *       인증 없이 호출할 수 있습니다.
 *     parameters:
 *       - in: path
 *         name: moverId
 *         required: true
 *         description: 기사님 ID
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         required: false
 *         description: 페이지 번호
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *       - in: query
 *         name: pageSize
 *         required: false
 *         description: 한 페이지당 리뷰 개수
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MoverReviewListResponse'
 *       400:
 *         description: moverId가 uuid 형식이 아니거나 page/pageSize가 올바르지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     CreateReviewResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/ReviewSummary'
 *
 * /reviews:
 *   post:
 *     tags: [Review]
 *     summary: 리뷰 작성
 *     description: |
 *       이사 완료된 견적에 리뷰를 작성합니다.
 *       견적의 고객만 작성할 수 있고, 견적당 리뷰는 1개만 작성할 수 있습니다.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [estimateId, content, rating]
 *             properties:
 *               estimateId:
 *                 type: string
 *                 format: uuid
 *                 description: 견적 ID
 *               content:
 *                 type: string
 *                 minLength: 10
 *                 description: 리뷰 내용 (최소 10자)
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: 평점 (1~5)
 *           examples:
 *             create:
 *               summary: 리뷰 작성
 *               value:
 *                 estimateId: 97941866-214d-492e-bb06-c6dcc72bbd03
 *                 content: 기사님이 너무 친절하셨어요. 짐도 안전하게 잘 옮겨주셨습니다.
 *                 rating: 5
 *     responses:
 *       201:
 *         description: 작성 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateReviewResponse'
 *       400:
 *         description: >
 *           code: VALIDATION_ERROR — estimateId/content/rating 필드 검증 실패.
 *           code: BAD_REQUEST — 이사 미완료 견적이거나 이미 리뷰가 있는 견적.
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
 *         description: 본인 견적이 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 존재하지 않는 견적
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
