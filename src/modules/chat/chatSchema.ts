import { z } from 'zod';
import { pageSizeSchema } from '../../utils/paginationSchema';

export const chatRoomParamsSchema = z.object({
  estimateId: z.uuid(),
});

export type ChatRoomParamsDto = z.infer<typeof chatRoomParamsSchema>;

export const getMessagesQuerySchema = z.object({
  cursor: z.uuid('커서 형식이 올바르지 않습니다.').optional(),
  size: pageSizeSchema(30),
});

export type GetMessagesQueryDto = z.infer<typeof getMessagesQuerySchema>;

export const sendMessageSchema = z
  .object({
    content: z
      .string('메시지 내용을 입력해 주세요.')
      .min(1, '메시지 내용을 입력해 주세요.')
      .optional(),
    // 이미지 업로드(POST .../image) 응답의 path(S3 key)를 그대로 보낸다.
    // 버킷이 private라 영구 URL이 없어서, 실제 URL은 조회 시점에 서명해서 내려준다.
    imagePath: z
      .string('이미지 경로를 입력해 주세요.')
      .min(1, '이미지 경로를 입력해 주세요.')
      .optional(),
  })
  .refine((value) => !!value.content || !!value.imagePath, {
    message: '메시지 내용 또는 이미지를 입력해 주세요.',
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// 경로에 그대로 들어가므로 확장자만 뽑아 쓴다 — '/'나 '..'가 섞여도 영향 없게.
// MIME/크기(4MB) 전부 presigned POST의 Conditions(content-length-range, Content-Type
// 일치)로 S3가 직접 강제한다 — 여기 정규식은 조기에 걸러주는 정도.
export const createImageUploadSchema = z.object({
  fileName: z
    .string('파일 이름을 입력해 주세요.')
    .min(1, '파일 이름을 입력해 주세요.')
    .regex(
      /\.(jpe?g|png|webp)$/i,
      'JPEG, PNG, WEBP 이미지만 업로드할 수 있습니다.'
    ),
});

export type CreateImageUploadInput = z.infer<typeof createImageUploadSchema>;
