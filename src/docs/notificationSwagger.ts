/**
 * notification 도메인 Swagger 문서입니다.
 * 실제 라우트/컨트롤러/서비스 코드는 src/modules/notification에 있고, 이 파일은 @openapi JSDoc만 모아둡니다.
 * 공통 ErrorResponse 스키마는 src/docs/swagger.ts에 정의되어 있습니다.
 *
 * @openapi
 * components:
 *   schemas:
 *     NotificationType:
 *       type: string
 *       enum: [NEW_ESTIMATE, NEW_REQUEST, ESTIMATE_CONFIRMED, MOVE_DAY]
 *       description: |
 *         NEW_ESTIMATE는 고객, NEW_REQUEST는 기사님이 받습니다.
 *         ESTIMATE_CONFIRMED와 MOVE_DAY는 양쪽 모두 받습니다.
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         userId:
 *           type: string
 *           format: uuid
 *         type:
 *           $ref: '#/components/schemas/NotificationType'
 *         content:
 *           type: string
 *           example: 김민재 기사님의 소형이사 견적이 도착했어요.
 *         targetPath:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: 알림을 눌렀을 때 이동할 견적 ID. 없으면 null.
 *         isRead:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *     NotificationListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: 알림 목록 조회 성공
 *         data:
 *           type: object
 *           properties:
 *             list:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *             nextCursor:
 *               type: string
 *               format: uuid
 *               nullable: true
 *               description: 다음 페이지 요청 시 cursor 쿼리로 그대로 전달. 더 없으면 null.
 *             totalCount:
 *               type: integer
 *               description: 로그인한 사용자의 알림 전체 수
 *     UnreadCountResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: 안 읽은 알림 개수 조회 성공
 *         data:
 *           type: object
 *           properties:
 *             unreadCount:
 *               type: integer
 *               example: 3
 *     ReadNotificationResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: 알림 읽음 처리 성공
 *         data:
 *           $ref: '#/components/schemas/Notification'
 *     ReadAllNotificationsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: 전체 알림 읽음 처리 성공
 *         data:
 *           type: object
 *           properties:
 *             count:
 *               type: integer
 *               description: 이번에 읽음으로 바뀐 알림 수
 *               example: 4
 *
 * /notifications:
 *   get:
 *     tags: [Notification]
 *     summary: 알림 목록 조회
 *     description: |
 *       로그인한 사용자의 알림 목록입니다. CUSTOMER와 MOVER 모두 호출할 수 있습니다.
 *       cursor 기반 무한 스크롤이며, 응답의 data.nextCursor를 다음 요청의 cursor로 그대로 넘기면 됩니다.
 *       최신 알림부터 내려갑니다.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: cursor
 *         required: false
 *         description: 직전 응답의 data.nextCursor. 첫 페이지는 생략.
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: size
 *         required: false
 *         description: 한 번에 가져올 개수
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationListResponse'
 *       400:
 *         description: cursor/size 값이 올바르지 않음 (VALIDATION_ERROR)
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
 *
 * /notifications/unread-count:
 *   get:
 *     tags: [Notification]
 *     summary: 안 읽은 알림 개수
 *     description: GNB 뱃지에 쓰는 안 읽은 알림 개수입니다.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnreadCountResponse'
 *       401:
 *         description: 인증 정보 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /notifications/stream:
 *   get:
 *     tags: [Notification]
 *     summary: 알림 SSE 스트림
 *     description: |
 *       연결을 유지하며 알림을 푸시합니다. 응답 형식은 `text/event-stream`입니다.
 *       연결 직후 `unread-count` 이벤트로 현재 뱃지 개수를 한 번 보냅니다.
 *       이후 알림이 생기면 `notification`, 읽음 처리로 개수가 바뀌면 `unread-count`가 옵니다.
 *       30초마다 주석 하트비트(`: heartbeat`)를 보냅니다.
 *
 *       이벤트:
 *       - `unread-count` — data: `{ "unreadCount": 3 }`
 *       - `notification` — data: Notification 객체
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 스트림 연결. 연결이 유지되는 동안 이벤트가 이어집니다.
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: |
 *                 event: unread-count
 *                 data: {"unreadCount":3}
 *
 *                 event: notification
 *                 data: {"id":"...","type":"NEW_ESTIMATE","content":"김민재 기사님의 소형이사 견적이 도착했어요.","isRead":false}
 *       401:
 *         description: 인증 정보 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /notifications/read-all:
 *   patch:
 *     tags: [Notification]
 *     summary: 알림 전체 읽음 처리
 *     description: 로그인한 사용자의 안 읽은 알림을 모두 읽음으로 바꿉니다. 연결된 SSE에도 unread-count를 푸시합니다.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 읽음 처리 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReadAllNotificationsResponse'
 *       401:
 *         description: 인증 정보 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notification]
 *     summary: 알림 읽음 처리
 *     description: |
 *       알림 하나를 읽음으로 바꿉니다. 본인 알림만 처리할 수 있습니다.
 *       연결된 SSE에도 unread-count를 푸시합니다.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 알림 ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 읽음 처리 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReadNotificationResponse'
 *       400:
 *         description: id가 uuid 형식이 아님 (VALIDATION_ERROR)
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
 *       404:
 *         description: 없거나 본인 알림이 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
