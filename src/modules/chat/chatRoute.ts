import { Router } from 'express';
import { validate } from '../../middlewares/validation';
import { authenticate } from '../../middlewares/authenticate';
import { chatController } from './chatController';
import { chatRoomParamsSchema } from './chatSchema';

const router = Router();

/** 채팅방 목록 조회 */
router.get('/', authenticate, chatController.getRooms);

/** 채팅 메시지 조회 */
router.get(
  '/:estimateId/messages',
  authenticate,
  validate(chatRoomParamsSchema, 'params'),
  chatController.getMessages
);

/** 채팅 메시지 전송 */
router.post(
  '/:estimateId/messages',
  authenticate,
  validate(chatRoomParamsSchema, 'params'),
  chatController.sendMessage
);

/** 채팅 메시지 읽음 처리 */
router.patch(
  '/:estimateId/read',
  authenticate,
  validate(chatRoomParamsSchema, 'params'),
  chatController.markRead
);

/** 채팅 메시지 읽지 않은 개수 조회 */
router.get(
  '/:estimateId/unread-count',
  authenticate,
  validate(chatRoomParamsSchema, 'params'),
  chatController.getUnreadCount
);

/** 채팅 이미지 업로드 */
router.post(
  '/:estimateId/image',
  authenticate,
  validate(chatRoomParamsSchema, 'params'),
  chatController.createImageUpload
);

export default router;
