import { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/error';
import { chatService } from './chatService';
import {
  createImageUploadSchema,
  getMessagesQuerySchema,
  sendMessageSchema,
  type ChatRoomParamsDto,
} from './chatSchema';

export const chatController = {
  /** 채팅방 목록 조회 */
  getRooms: async (req: Request, res: Response) => {
    if (!req.auth?.sub) throw new UnauthorizedError();

    const result = await chatService.getRooms(req.auth.sub, req.auth.role);

    res.status(200).json({ success: true, data: result });
  },

  /** 채팅 메시지 조회 */
  getMessages: async (req: Request, res: Response) => {
    if (!req.auth?.sub) throw new UnauthorizedError();

    const { estimateId } = req.validatedData as ChatRoomParamsDto;
    const query = getMessagesQuerySchema.parse(req.query);
    const result = await chatService.getMessages(
      req.auth.sub,
      req.auth.role,
      estimateId,
      query
    );

    res.status(200).json({ success: true, data: result });
  },

  /** 채팅 메시지 전송 */
  sendMessage: async (req: Request, res: Response) => {
    if (!req.auth?.sub) throw new UnauthorizedError();

    const { estimateId } = req.validatedData as ChatRoomParamsDto;
    const input = sendMessageSchema.parse(req.body);
    const result = await chatService.sendMessage(
      req.auth.sub,
      req.auth.role,
      estimateId,
      input
    );

    res.status(201).json({ success: true, data: result });
  },

  /** 채팅 메시지 읽음 처리 */
  markRead: async (req: Request, res: Response) => {
    if (!req.auth?.sub) throw new UnauthorizedError();

    const { estimateId } = req.validatedData as ChatRoomParamsDto;
    await chatService.markRead(req.auth.sub, req.auth.role, estimateId);

    res.status(200).json({ success: true, data: null });
  },

  /** 채팅 메시지 읽지 않은 개수 조회 */
  getUnreadCount: async (req: Request, res: Response) => {
    if (!req.auth?.sub) throw new UnauthorizedError();

    const { estimateId } = req.validatedData as ChatRoomParamsDto;
    const result = await chatService.getUnreadCount(
      req.auth.sub,
      req.auth.role,
      estimateId
    );

    res.status(200).json({ success: true, data: result });
  },

  /** 채팅 이미지 업로드 */
  createImageUpload: async (req: Request, res: Response) => {
    if (!req.auth?.sub) throw new UnauthorizedError();

    const { estimateId } = req.validatedData as ChatRoomParamsDto;
    const input = createImageUploadSchema.parse(req.body);
    const result = await chatService.createImageUpload(
      req.auth.sub,
      req.auth.role,
      estimateId,
      input
    );

    res.status(201).json({ success: true, data: result });
  },
};
