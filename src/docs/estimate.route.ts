/**
 * estimate 도메인 Swagger 문서입니다.
 * 실제 라우트/컨트롤러/서비스 코드는 src/modules/estimate에 있고, 이 파일은 @openapi JSDoc만 모아둡니다.
 * 공통 ErrorResponse 스키마는 src/docs/swagger.ts에 정의되어 있습니다.
 *
 * @openapi
 * components:
 *   schemas:
 *     MoverSummary:
 *       type: object
 *       properties:
 *         moverId:
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
 *     EstimateRequestSummary:
 *       type: object
 *       properties:
 *         estimateRequestId:
 *           type: string
 *           format: uuid
 *         serviceType:
 *           type: string
 *           enum: [SMALL_MOVE, HOME_MOVE, OFFICE_MOVE]
 *         moveDate:
 *           type: string
 *           format: date-time
 *         departureZipCode:
 *           type: integer
 *         departureAddress:
 *           type: string
 *         arrivalZipCode:
 *           type: integer
 *         arrivalAddress:
 *           type: string
 *         requestedAt:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [PENDING, CONFIRMED, COMPLETED, EXPIRED]
 *     EstimateSummary:
 *       type: object
 *       properties:
 *         estimateId:
 *           type: string
 *           format: uuid
 *         price:
 *           type: integer
 *           nullable: true
 *           example: 310000
 *         comment:
 *           type: string
 *           nullable: true
 *         rejectReason:
 *           type: string
 *           nullable: true
 *         isDesignated:
 *           type: boolean
 *         status:
 *           type: string
 *           enum: [REJECTED, DESIGNATED, PROPOSED, ACCEPTED, NOT_SELECTED, EXPIRED]
 *           description: CUSTOMER 관점 응답에는 DESIGNATED/REJECTED가 절대 포함되지 않습니다.
 *         createdAt:
 *           type: string
 *           format: date-time
 *         mover:
 *           $ref: '#/components/schemas/MoverSummary'
 *     EstimateGroup:
 *       type: object
 *       properties:
 *         estimateRequest:
 *           $ref: '#/components/schemas/EstimateRequestSummary'
 *         estimates:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/EstimateSummary'
 *         totalCount:
 *           type: integer
 *           description: 이 견적 요청에 달린 견적 개수 (estimates 배열 길이)
 *     EstimateListResponse:
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
 *                 $ref: '#/components/schemas/EstimateGroup'
 *             nextCursor:
 *               type: string
 *               format: uuid
 *               nullable: true
 *               description: 다음 페이지 요청 시 cursor 쿼리로 그대로 전달. 더 없으면 null.
 *             totalCount:
 *               type: integer
 *               description: 조건에 맞는 전체 견적 요청 건수
 *
 * /estimates:
 *   get:
 *     tags: [Estimate]
 *     summary: 내 견적 목록 조회 (무한 스크롤)
 *     description: |
 *       토큰의 role(CUSTOMER/MOVER)로 조회 관점이 결정됩니다. 응답은 항상 견적 요청 단위로 묶입니다.
 *       CUSTOMER 관점에는 DESIGNATED(지정견적 요청)/REJECTED(지정견적 반려) 상태가 제외됩니다.
 *       cursor 기반 무한 스크롤이며, 응답의 data.nextCursor를 다음 요청의 cursor로 그대로 넘기면 됩니다.
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         description: >
 *           EstimateStatus 값(콤마로 여러 개 나열 가능) 또는 closed(=ACCEPTED,NOT_SELECTED,EXPIRED).
 *           예) PROPOSED / closed / PROPOSED,ACCEPTED,NOT_SELECTED
 *         schema:
 *           type: string
 *       - in: query
 *         name: serviceType
 *         required: false
 *         schema:
 *           type: string
 *           enum: [SMALL_MOVE, HOME_MOVE, OFFICE_MOVE]
 *       - in: query
 *         name: cursor
 *         required: false
 *         description: 직전 응답의 data.nextCursor 값
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: size
 *         required: false
 *         description: 한 번에 가져올 견적 요청 개수
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EstimateListResponse'
 *       400:
 *         description: status/serviceType/cursor 값이 올바르지 않음
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
 *     CustomerSummary:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: 김민서
 *     EstimateDetailResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             estimateId:
 *               type: string
 *               format: uuid
 *             price:
 *               type: integer
 *               nullable: true
 *               example: 180000
 *             comment:
 *               type: string
 *               nullable: true
 *             rejectReason:
 *               type: string
 *               nullable: true
 *             isDesignated:
 *               type: boolean
 *             status:
 *               type: string
 *               enum: [REJECTED, DESIGNATED, PROPOSED, ACCEPTED, NOT_SELECTED, EXPIRED]
 *             createdAt:
 *               type: string
 *               format: date-time
 *             mover:
 *               $ref: '#/components/schemas/MoverSummary'
 *             customer:
 *               $ref: '#/components/schemas/CustomerSummary'
 *             estimateRequest:
 *               $ref: '#/components/schemas/EstimateRequestSummary'
 *             canConfirm:
 *               type: boolean
 *               description: CUSTOMER 관점 - 본인 요청 + 요청 PENDING + 견적 PROPOSED일 때만 true
 *             canRespond:
 *               type: boolean
 *               description: MOVER 관점 - 본인 견적 + 요청 PENDING + 견적 DESIGNATED일 때만 true
 *
 * /estimates/{estimateId}:
 *   get:
 *     tags: [Estimate]
 *     summary: 견적 상세 조회
 *     description: |
 *       status가 NOT_SELECTED/EXPIRED면 프론트에서 "확정하지 않은 견적이에요!" 배너를 표시합니다.
 *     security:
 *       - cookieAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: estimateId
 *         required: true
 *         description: 견적서 ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EstimateDetailResponse'
 *       400:
 *         description: estimateId가 uuid 형식이 아님
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
 *         description: 본인의 견적/요청이 아님
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

/**
 * @openapi
 * components:
 *   schemas:
 *     UpdateEstimateStatusResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             estimateId:
 *               type: string
 *               format: uuid
 *             estimateRequestId:
 *               type: string
 *               format: uuid
 *             status:
 *               type: string
 *               enum: [PROPOSED, REJECTED, ACCEPTED]
 *
 * /estimates/{estimateId}:
 *   patch:
 *     tags: [Estimate]
 *     summary: 견적 상태 전환 (발송 / 반려 / 확정)
 *     description: |
 *       body.status 값에 따라 세 가지 동작을 처리한다.
 *       - PROPOSED (MOVER): DESIGNATED → PROPOSED, price/comment 필요
 *       - REJECTED (MOVER): DESIGNATED → REJECTED, rejectReason 필요
 *       - ACCEPTED (CUSTOMER): PROPOSED → ACCEPTED, 추가 필드 없음
 *
 *       ACCEPTED 처리 시 같은 요청의 나머지 PROPOSED 견적은 NOT_SELECTED로,
 *       견적 요청은 CONFIRMED로 함께 전환된다. DESIGNATED로 남은 행은 건드리지 않는다.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: estimateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required: [status, price, comment]
 *                 properties:
 *                   status:
 *                     type: string
 *                     enum: [PROPOSED]
 *                   price:
 *                     type: integer
 *                     example: 180000
 *                   comment:
 *                     type: string
 *                     minLength: 10
 *               - type: object
 *                 required: [status, rejectReason]
 *                 properties:
 *                   status:
 *                     type: string
 *                     enum: [REJECTED]
 *                   rejectReason:
 *                     type: string
 *                     minLength: 10
 *               - type: object
 *                 required: [status]
 *                 properties:
 *                   status:
 *                     type: string
 *                     enum: [ACCEPTED]
 *           examples:
 *             propose:
 *               summary: 견적 발송
 *               value: { status: 'PROPOSED', price: 180000, comment: '안전하게 모시겠습니다. 감사합니다.' }
 *             reject:
 *               summary: 반려
 *               value: { status: 'REJECTED', rejectReason: '해당 날짜에 일정이 있어 어렵습니다.' }
 *             accept:
 *               summary: 확정
 *               value: { status: 'ACCEPTED' }
 *     responses:
 *       200:
 *         description: 전환 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UpdateEstimateStatusResponse'
 *       400:
 *         description: >
 *           code: BAD_REQUEST — 허용되지 않는 status 값이거나(전환 대상이 아님),
 *           price/comment/rejectReason 등 필드 검증 실패(이 경우 code는 VALIDATION_ERROR).
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
 *         description: 본인의 견적/요청이 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 존재하지 않는 견적 (NOT_FOUND)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: >
 *           code: CONFLICT — 현재 상태에서 불가능한 전환 / 이미 확정된 요청 / 이사일이 지난 요청.
 *           구체적인 사유는 message로 구분한다.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
