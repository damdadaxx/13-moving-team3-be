import { randomUUID } from 'node:crypto';
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { prisma } from '../../lib/prisma';
import { s3Client } from '../../lib/s3';
import { ENV } from '../../config/env';
import { buildCursorArgs } from '../../utils/cursorPagination';
import type { ChatMessage } from '../../generated/prisma/client';

// 프로필 이미지(S3 + CloudFront 공개 서빙)와 달리, 채팅 이미지는 비공개 1:1 대화 내용이라
// presigned URL로만 접근하게 한다 — CloudFront로 공개 서빙하면 URL만 알아도 누구나 볼 수 있다.
// 같은 버킷을 쓰되 "chat/" 하위 경로만 쓰고, CloudFront 배포가 이 경로까지 캐싱/공개하지
// 않는지는 별도로 확인해야 한다 (코드만으로는 보장 못 하는 인프라 설정).
const CHAT_IMAGE_PREFIX = 'chat';
const SIGNED_IMAGE_URL_TTL_SECONDS = 60 * 10;
// presigned POST의 content-length-range 조건으로 강제한다 — PUT 방식(SigV4)으로는
// 바이트 크기를 강제할 방법이 없어서 POST로 바꿨다.
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const buildKey = (estimateId: string, extension: string) =>
  `${CHAT_IMAGE_PREFIX}/${estimateId}/${randomUUID()}${extension}`;

export const chatRepository = {
  /** 채팅 메시지 저장 */
  insertMessage: (input: {
    estimateId: string;
    senderId: string;
    content?: string;
    imagePath?: string;
  }) => {
    return prisma.chatMessage.create({
      data: {
        estimateId: input.estimateId,
        senderId: input.senderId,
        content: input.content ?? null,
        imagePath: input.imagePath ?? null,
      },
    });
  },

  /** 채팅 메시지 목록 조회 (최신순, 커서 페이지네이션은 서비스 레이어에서 처리) */
  listMessages: (input: {
    estimateId: string;
    cursor?: string;
    size: number;
  }) => {
    return prisma.chatMessage.findMany({
      where: { estimateId: input.estimateId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...buildCursorArgs(input.cursor, input.size),
    });
  },

  /** 채팅 메시지 읽음 처리 */
  markRead: (input: { estimateId: string; readerId: string }) => {
    return prisma.chatMessage.updateMany({
      where: {
        estimateId: input.estimateId,
        senderId: { not: input.readerId }, // 본인이 보낸 메시지는 읽음 처리하지 않음
        isRead: false,
      },
      data: { isRead: true },
    });
  },

  /** 채팅 메시지 읽지 않은 개수 조회 */
  countUnread: (input: { estimateId: string; readerId: string }) => {
    return prisma.chatMessage.count({
      where: {
        estimateId: input.estimateId,
        senderId: { not: input.readerId },
        isRead: false,
      },
    });
  },

  /** 채팅방 목록용 — 방 하나의 마지막 메시지.
   * 방마다 따로(병렬로) 조회한다 — IN절로 한 번에 긁어 메모리에서 그룹별 최신 1건을 추리면
   * 메시지 많은 방이 섞였을 때 불필요하게 큰 결과셋을 끌고 오게 된다.
   */
  getLastMessage: (estimateId: string) => {
    return prisma.chatMessage.findFirst({
      where: { estimateId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  },

  /** path가 이 채팅방 폴더에 실제 업로드된 파일인지 확인 (message에 끼워 넣기 전 검증용) */
  imageExists: async (estimateId: string, path: string) => {
    const folder = `${CHAT_IMAGE_PREFIX}/${estimateId}/`;
    if (!path.startsWith(folder)) return false;

    try {
      await s3Client.send(
        new HeadObjectCommand({ Bucket: ENV.S3_BUCKET_NAME, Key: path })
      );
      return true;
    } catch {
      return false;
    }
  },

  /** path(들)에 대한 signed URL을 한 번에 발급한다. (버킷이 private라 영구 URL이 없음)
   * getSignedUrl은 로컬 서명 계산이라 네트워크 호출 없이 병렬로 돌려도 안전하다.
   */
  signImageUrls: async (paths: string[]) => {
    if (paths.length === 0) return new Map<string, string>();

    const entries = await Promise.all(
      paths.map(async (path) => {
        const url = await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: ENV.S3_BUCKET_NAME, Key: path }),
          { expiresIn: SIGNED_IMAGE_URL_TTL_SECONDS }
        );
        return [path, url] as const;
      })
    );

    return new Map(entries);
  },

  /** 채팅 이미지 업로드용 presigned POST 발급.
   * fileName은 스키마에서 확장자 형식만 검증했을 뿐 신뢰할 수 없으니,
   * 경로에는 절대 그대로 안 쓰고 확장자만 뽑아 붙인다.
   * PUT이 아니라 POST인 이유: content-length-range 조건으로 4MB 제한을 S3 쪽에서
   * 직접 강제하려면 POST 정책 방식이어야 한다 (SigV4 presigned PUT엔 그 기능이 없다).
   */
  createImageUploadUrl: async (input: {
    estimateId: string;
    fileName: string;
  }) => {
    const extension = input.fileName
      .slice(input.fileName.lastIndexOf('.'))
      .toLowerCase();
    const key = buildKey(input.estimateId, extension);
    const contentType = MIME_TYPE_BY_EXTENSION[extension];

    const { url, fields } = await createPresignedPost(s3Client, {
      Bucket: ENV.S3_BUCKET_NAME,
      Key: key,
      Conditions: [
        ['content-length-range', 0, MAX_IMAGE_SIZE_BYTES],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
      Expires: SIGNED_IMAGE_URL_TTL_SECONDS,
    });

    return { uploadUrl: url, fields, path: key };
  },
};

export type { ChatMessage as ChatMessageRow };
