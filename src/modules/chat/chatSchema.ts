import { z } from 'zod';
import { pageSizeSchema } from '../../utils/paginationSchema';

export const chatRoomParamsSchema = z.object({
  estimateId: z.uuid(),
});

export type ChatRoomParamsDto = z.infer<typeof chatRoomParamsSchema>;

// chat_messages.id는 Supabase 쪽 bigint라 문자열로 주고받는다.
export const getMessagesQuerySchema = z.object({
  cursor: z
    .string()
    .regex(/^\d+$/, '커서 형식이 올바르지 않습니다.')
    .optional(),
  size: pageSizeSchema(30),
});

export type GetMessagesQueryDto = z.infer<typeof getMessagesQuerySchema>;

export const sendMessageSchema = z
  .object({
    content: z
      .string('메시지 내용을 입력해 주세요.')
      .min(1, '메시지 내용을 입력해 주세요.')
      .optional(),
    // 이미지 업로드(POST .../image) 응답의 path를 그대로 보낸다.
    // chat-images 버킷이 private라 영구 URL이 없어서, 방금 올린 파일을 가리키는
    // 토큰 없는 경로만 받고 실제 URL은 조회 시점에 서명해서 내려준다.
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
// 확장자 목록은 chat-images 버킷의 allowed_mime_types(jpeg/png/webp)와 맞춘다.
// 실제 크기(5MB)/MIME 강제는 presigned PUT이 우리 서버를 거치지 않으므로
// Supabase Storage 버킷 설정(supabase/migrations/0002_bucket_limits.sql)에서 한다 — 여기선 조기에 걸러주는 정도.
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
