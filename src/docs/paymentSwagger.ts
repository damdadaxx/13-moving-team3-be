/**
 * payment 도메인 Swagger 문서입니다.
 * 실제 라우트/컨트롤러/서비스 코드는 src/modules/payment에 있고, 이 파일은 @openapi JSDoc만 모아둡니다.
 * 공통 ErrorResponse 스키마는 src/docs/swagger.ts에 정의되어 있습니다.
 *
 * 결제는 토스페이먼츠 결제창 v2 SDK로 진행한다.
 *   1) 견적 확정(ACCEPTED) 후 선수금(견적가의 10%, 내림) 결제
 *   2) 이사일이 지나 견적 요청이 COMPLETED가 되면 잔금(견적가 - 선수금) 결제
 * 금액은 항상 서버가 견적 가격에서 계산한다. 클라이언트가 보낸 금액은 주문과 대조만 한다.
 *
 * @openapi
 * components:
 *   schemas:
 *     PaymentInfo:
 *       type: object
 *       properties:
 *         paymentId:
 *           type: string
 *           format: uuid
 *         type:
 *           type: string
 *           enum: [DEPOSIT, BALANCE]
 *         amount:
 *           type: integer
 *           example: 100000
 *         status:
 *           type: string
 *           enum: [READY, PAID, CANCELED, FAILED]
 *         paidAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *
 * /estimates/{estimateId}/payments:
 *   get:
 *     tags: [Payment]
 *     summary: 견적의 결제 현황 조회 (고객 본인 견적만)
 *     description: |
 *       선수금·잔금 금액과 결제 상태, 지금 결제할 수 있는지 여부를 돌려준다.
 *       - canPayDeposit: 견적이 ACCEPTED이고 선수금이 PAID가 아님
 *       - canPayBalance: 선수금이 PAID이고 견적 요청이 COMPLETED이며 잔금이 PAID가 아님
 *       - isSettled: 잔금까지 PAID
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: estimateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *                     estimateId:
 *                       type: string
 *                       format: uuid
 *                     price:
 *                       type: integer
 *                       example: 1000000
 *                     depositAmount:
 *                       type: integer
 *                       example: 100000
 *                     balanceAmount:
 *                       type: integer
 *                       example: 900000
 *                     deposit:
 *                       nullable: true
 *                       allOf:
 *                         - $ref: '#/components/schemas/PaymentInfo'
 *                     balance:
 *                       nullable: true
 *                       allOf:
 *                         - $ref: '#/components/schemas/PaymentInfo'
 *                     canPayDeposit:
 *                       type: boolean
 *                     canPayBalance:
 *                       type: boolean
 *                     isSettled:
 *                       type: boolean
 *       401:
 *         description: 인증 정보 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 고객이 아니거나 본인 견적이 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 견적을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     tags: [Payment]
 *     summary: 결제 주문 생성 (토스 결제창을 열기 전에 호출)
 *     description: |
 *       결제 조건(canPay*)을 서버가 검증하고 주문을 만든다.
 *       - 결제 전(READY) 주문이 이미 있으면 같은 orderId를 다시 돌려준다.
 *       - 승인이 거절됐던(FAILED) 주문은 새 orderId로 다시 연다.
 *       - customerKey는 고객의 User.id를 쓴다.
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
 *             type: object
 *             required: [type]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [DEPOSIT, BALANCE]
 *     responses:
 *       200:
 *         description: 주문 생성 성공
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
 *                     orderId:
 *                       type: string
 *                       example: moving_3f1c9a52-7d0e-4b6a-9c11-0a5e2f6d8b34
 *                     orderName:
 *                       type: string
 *                       example: 김민재 기사님 이사 선수금
 *                     amount:
 *                       type: integer
 *                       example: 100000
 *                     customerKey:
 *                       type: string
 *                       format: uuid
 *                     customerName:
 *                       type: string
 *       400:
 *         description: 결제할 수 있는 상태가 아님 (미확정 견적, 이사 완료 전 잔금 등) 또는 body 검증 실패
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
 *         description: 고객이 아니거나 본인 견적이 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 견적을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: 이미 결제가 완료됨
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /payments/confirm:
 *   post:
 *     tags: [Payment]
 *     summary: 결제 승인 (토스 successUrl로 돌아온 뒤 호출)
 *     description: |
 *       저장된 주문과 orderId·amount를 대조한 뒤 토스 승인 API를 호출하고 PAID로 저장한다.
 *       같은 요청이 반복돼도 이미 PAID면 성공으로 응답한다(멱등).
 *       토스가 거절하면 400으로 토스의 code·message를 error.message에 담아 돌려주고, 같은 견적을 다시 주문하면 새 orderId를 받는다.
 *       토스 서버 오류나 통신 실패는 503이며, 결제 상태는 READY로 남아 같은 요청을 다시 보낼 수 있다.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paymentKey, orderId, amount]
 *             properties:
 *               paymentKey:
 *                 type: string
 *               orderId:
 *                 type: string
 *               amount:
 *                 type: integer
 *                 example: 100000
 *     responses:
 *       200:
 *         description: 승인 성공 (이미 승인된 주문의 재요청 포함)
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
 *                     paymentId:
 *                       type: string
 *                       format: uuid
 *                     estimateId:
 *                       type: string
 *                       format: uuid
 *                     type:
 *                       type: string
 *                       enum: [DEPOSIT, BALANCE]
 *                     amount:
 *                       type: integer
 *                     status:
 *                       type: string
 *                       example: PAID
 *                     paidAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *       400:
 *         description: 금액 불일치, 결제할 수 없는 상태, 토스가 승인을 거절함, body 검증 실패
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
 *         description: 고객이 아니거나 본인 주문이 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 주문을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: 이미 다른 결제 키로 완료된 주문
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         description: 토스 서버 오류, 통신 실패, 결제 설정(TOSS_SECRET_KEY) 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
