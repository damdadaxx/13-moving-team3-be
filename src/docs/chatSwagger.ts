/**
 * chat 도메인 Swagger 문서입니다.
 * 실제 라우트/컨트롤러/서비스 코드는 src/modules/chat에 있고, 이 파일은 @openapi JSDoc만 모아둡니다.
 * 공통 ErrorResponse 스키마는 src/docs/swagger.ts에 정의되어 있습니다.
 *
 * @openapi
 * components:
 *   schemas:
 *     ChatMessage:
 *       type: object
 *       properties:
 *         messageId:
 *           type: string
 *           description: Supabase bigint id (문자열로 전달)
 *           example: "42"
 *         senderId:
 *           type: string
 *           format: uuid
 *         content:
 *           type: string
 *           nullable: true
 *         imageUrl:
 *           type: string
 *           nullable: true
 *           description: >
 *             조회 시점에 발급한 signed URL (10분 만료). chat-images 버킷이 private라
 *             영구 URL이 없고, 매 응답마다 새로 서명해서 내려준다.
 *         isRead:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *     ChatMessageListResponse:
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
 *                 $ref: '#/components/schemas/ChatMessage'
 *             nextCursor:
 *               type: string
 *               nullable: true
 *               description: 다음 페이지 요청 시 cursor로 사용. 없으면 마지막 페이지.
 *     SendMessageResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/ChatMessage'
 *     UnreadCountResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             unreadCount:
 *               type: integer
 *               example: 3
 *     ImageUploadResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             uploadUrl:
 *               type: string
 *               description: Supabase Storage presigned 업로드 URL (PUT)
 *             path:
 *               type: string
 *               description: 버킷 내 저장 경로. 업로드 성공 후 이 경로를 메시지 전송의 imagePath로 그대로 보낸다.
 *             token:
 *               type: string
 *               description: presigned 업로드용 토큰
 *     ChatRoomListItem:
 *       type: object
 *       properties:
 *         estimateId:
 *           type: string
 *           format: uuid
 *         otherParty:
 *           type: object
 *           description: 상대방 정보 (고객이면 기사님, 기사님이면 고객)
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             name:
 *               type: string
 *             imgUrl:
 *               type: string
 *               nullable: true
 *         lastMessage:
 *           allOf:
 *             - $ref: '#/components/schemas/ChatMessage'
 *           nullable: true
 *           description: 아직 메시지가 없는 방이면 null
 *         unreadCount:
 *           type: integer
 *           example: 2
 *     ChatRoomListResponse:
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
 *                 $ref: '#/components/schemas/ChatRoomListItem'
 *
 * /chat/rooms:
 *   get:
 *     tags: [Chat]
 *     summary: 채팅방 목록 조회
 *     description: |
 *       내가 참여 중인 채팅방(견적 ACCEPTED, 요청 상태 CONFIRMED 또는 COMPLETED) 목록을
 *       마지막 메시지 최신순으로 반환합니다. 메시지가 없는 방은 목록 뒤로 밀립니다.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatRoomListResponse'
 *       401:
 *         description: 인증 정보 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /chat/rooms/{estimateId}/messages:
 *   get:
 *     tags: [Chat]
 *     summary: 채팅 메시지 목록 조회 (커서 페이지네이션)
 *     description: |
 *       확정(ACCEPTED) 견적의 채팅방 메시지를 최신순으로 조회합니다.
 *       견적의 고객/기사님 당사자만 조회할 수 있고, 이사 완료(COMPLETED) 후에도 기록 조회는 가능합니다.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: estimateId
 *         required: true
 *         description: 견적 ID (채팅방 키)
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: cursor
 *         required: false
 *         description: 이전 응답의 nextCursor. 없으면 최신 메시지부터 조회.
 *         schema:
 *           type: string
 *       - in: query
 *         name: size
 *         required: false
 *         description: 페이지당 메시지 수
 *         schema:
 *           type: integer
 *           default: 30
 *           minimum: 1
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatMessageListResponse'
 *       400:
 *         description: cursor가 숫자 문자열이 아니거나 size가 올바르지 않음 (VALIDATION_ERROR)
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
 *         description: >
 *           본인의 채팅방이 아니거나, 견적이 확정(ACCEPTED) 상태가 아니거나,
 *           요청 상태가 CONFIRMED/COMPLETED가 아님.
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
 *   post:
 *     tags: [Chat]
 *     summary: 채팅 메시지 전송
 *     description: |
 *       content 또는 imagePath 중 하나는 반드시 있어야 합니다.
 *       이사 완료(COMPLETED) 후에는 전송할 수 없고 조회만 가능합니다.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: estimateId
 *         required: true
 *         description: 견적 ID (채팅방 키)
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *               imagePath:
 *                 type: string
 *                 description: >
 *                   이미지 업로드(POST .../image) 응답의 path를 그대로 보낸다.
 *                   이 채팅방 폴더에 실제 업로드된 파일이 아니면 403.
 *           examples:
 *             text:
 *               summary: 텍스트 메시지
 *               value:
 *                 content: 안녕하세요, 이사 전날 짐 포장 관련 문의드립니다.
 *             image:
 *               summary: 이미지 메시지
 *               value:
 *                 imagePath: 40000000-0000-4000-8000-000000000005/9b1c...-room.png
 *     responses:
 *       201:
 *         description: 전송 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SendMessageResponse'
 *       400:
 *         description: content/imagePath 둘 다 없음 (VALIDATION_ERROR)
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
 *         description: >
 *           본인의 채팅방이 아니거나, 견적/요청 상태가 전송 가능한 상태가 아니거나,
 *           이사 완료 후라 조회만 가능하거나, imagePath가 이 방에 업로드된 파일이 아님.
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
 *
 * /chat/rooms/{estimateId}/read:
 *   patch:
 *     tags: [Chat]
 *     summary: 채팅 메시지 읽음 처리
 *     description: 해당 채팅방에서 본인이 아직 읽지 않은 메시지를 모두 읽음 처리합니다.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: estimateId
 *         required: true
 *         description: 견적 ID (채팅방 키)
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 처리 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   nullable: true
 *                   example: null
 *       401:
 *         description: 인증 정보 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 본인의 채팅방이 아니거나 이사 완료 후라 읽음 처리할 수 없음
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
 *
 * /chat/rooms/{estimateId}/unread-count:
 *   get:
 *     tags: [Chat]
 *     summary: 읽지 않은 메시지 수 조회
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: estimateId
 *         required: true
 *         description: 견적 ID (채팅방 키)
 *         schema:
 *           type: string
 *           format: uuid
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
 *       403:
 *         description: 본인의 채팅방이 아니거나 견적/요청 상태가 이용 가능한 상태가 아님
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
 *
 * /chat/rooms/{estimateId}/image:
 *   post:
 *     tags: [Chat]
 *     summary: 채팅 이미지 업로드 URL 발급
 *     description: |
 *       Storage presigned 업로드 URL을 발급합니다. 클라이언트는 이 URL로 PUT 업로드한 뒤,
 *       응답의 path를 메시지 전송(POST /chat/rooms/{estimateId}/messages)의 imagePath로 그대로 보냅니다.
 *       jpeg/png/webp, 5MB 이하만 허용되며 버킷 자체가 타입/용량이 안 맞으면 PUT을 거부합니다.
 *       이사 완료(COMPLETED) 후에는 발급할 수 없습니다.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: estimateId
 *         required: true
 *         description: 견적 ID (채팅방 키)
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fileName]
 *             properties:
 *               fileName:
 *                 type: string
 *                 minLength: 1
 *                 description: 확장자가 jpg/jpeg/png/webp 중 하나여야 한다.
 *                 example: photo.jpg
 *     responses:
 *       201:
 *         description: 발급 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImageUploadResponse'
 *       400:
 *         description: fileName이 비어 있음 (VALIDATION_ERROR)
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
 *         description: 본인의 채팅방이 아니거나 이사 완료 후라 업로드할 수 없음
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
