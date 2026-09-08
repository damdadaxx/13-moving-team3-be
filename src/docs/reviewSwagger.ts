/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: 리뷰 관련 API
 */

/**
 * @swagger
 * /reviews/me:
 *   get:
 *     summary: 내 리뷰 목록 조회
 *     description: 이사 완료된 견적 목록을 조회합니다. hasReview 파라미터로 리뷰 작성 여부를 필터링할 수 있습니다.
 *     tags: [Reviews]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *         description: 페이지당 항목 수
 *       - in: query
 *         name: hasReview
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: 리뷰 작성 여부 필터 (true=작성 완료, 생략하거나 false=미작성, )
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     list:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                             description: 견적 ID
 *                           price:
 *                             type: integer
 *                             nullable: true
 *                             description: 견적 금액
 *                           mover:
 *                             type: object
 *                             properties:
 *                               userId:
 *                                 type: string
 *                                 format: uuid
 *                               imgUrl:
 *                                 type: string
 *                                 nullable: true
 *                               nickname:
 *                                 type: string
 *                               shortIntro:
 *                                 type: string
 *                           estimateRequest:
 *                             type: object
 *                             properties:
 *                               customerId:
 *                                 type: string
 *                                 format: uuid
 *                               serviceType:
 *                                 type: string
 *                                 enum: [SMALL_MOVE, HOME_MOVE, OFFICE_MOVE]
 *                               departureAddress:
 *                                 type: string
 *                               arrivalAddress:
 *                                 type: string
 *                               moveDate:
 *                                 type: string
 *                                 format: date-time
 *                               status:
 *                                 type: string
 *                                 enum: [PENDING, CONFIRMED, COMPLETED, EXPIRED]
 *                           review:
 *                             type: object
 *                             nullable: true
 *                             description: 작성된 리뷰 (없으면 null)
 *                     totalPages:
 *                       type: integer
 *                       description: 전체 페이지 수
 *       400:
 *         description: 잘못된 요청 (쿼리 파라미터 유효성 검사 실패)
 *       401:
 *         description: 인증 필요
 */

/**
 * @swagger
 * /reviews/mover/{moverId}:
 *   get:
 *     summary: 기사님 리뷰 목록 조회
 *     description: 특정 기사님의 리뷰 목록과 평점 통계를 조회합니다.
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: moverId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 기사님 ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *         description: 페이지당 항목 수
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     list:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           estimateId:
 *                             type: string
 *                             format: uuid
 *                           customerId:
 *                             type: string
 *                             format: uuid
 *                           moverId:
 *                             type: string
 *                             format: uuid
 *                           rating:
 *                             type: integer
 *                             minimum: 1
 *                             maximum: 5
 *                           content:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     ratingDistribution:
 *                       type: array
 *                       description: 점수별 리뷰 개수
 *                       items:
 *                         type: object
 *                         properties:
 *                           rating:
 *                             type: integer
 *                             minimum: 1
 *                             maximum: 5
 *                           count:
 *                             type: integer
 *                     ratingAvg:
 *                       type: number
 *                       format: float
 *                       nullable: true
 *                       description: 평균 평점
 *                     reviewCount:
 *                       type: integer
 *                       description: 총 리뷰 수
 *                     totalPages:
 *                       type: integer
 *                       description: 전체 페이지 수
 *       400:
 *         description: 잘못된 moverId 형식
 *       404:
 *         description: 기사님을 찾을 수 없음
 */

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: 리뷰 작성
 *     description: 이사 완료된 견적에 리뷰를 작성합니다. 견적의 소유자만 작성 가능하며, 견적당 리뷰는 1개만 작성할 수 있습니다.
 *     tags: [Reviews]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - estimateId
 *               - content
 *               - rating
 *             properties:
 *               estimateId:
 *                 type: string
 *                 format: uuid
 *                 description: 견적 ID
 *                 example: 97941866-214d-492e-bb06-c6dcc72bbd03
 *               content:
 *                 type: string
 *                 minLength: 10
 *                 description: 리뷰 내용 (최소 10자)
 *                 example: 기사님이 너무 친절하셨어요. 짐도 안전하게 잘 옮겨주셨습니다.
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: 평점 (1~5)
 *                 example: 5
 *     responses:
 *       201:
 *         description: 리뷰 작성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     estimateId:
 *                       type: string
 *                       format: uuid
 *                     customerId:
 *                       type: string
 *                       format: uuid
 *                     moverId:
 *                       type: string
 *                       format: uuid
 *                     rating:
 *                       type: integer
 *                     content:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: 잘못된 요청 (이사 미완료 상태이거나 이미 리뷰가 존재하는 경우)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 완료된 상태의 견적서만 리뷰를 할 수 있습니다.
 *       401:
 *         description: 인증 필요
 *       403:
 *         description: 리뷰 작성 권한 없음 (본인 견적이 아닌 경우)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 리뷰 작성 권한이 없는 견적서입니다.
 *       404:
 *         description: 견적 정보를 찾을 수 없음
 */
