import { randomUUID } from 'node:crypto';
import { supabase } from '../../lib/supabase';
import { ServiceUnavailableError } from '../../utils/error';

/** chat_messages 테이블 컬럼은 snake_case
 * - (supabase/migrations/0001_init.sql 참고) */
type ChatMessageRow = {
  id: number;
  estimate_id: string;
  customer_id: string;
  mover_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  is_read: boolean;
  created_at: string;
};

// 이미지 조회 응답에 내려주는 signed URL 유효시간. chat-images 버킷이 private라
// 영구 URL이 없어서, 메시지를 돌려줄 때마다 저장된 path로 새로 발급한다.
const SIGNED_IMAGE_URL_TTL_SECONDS = 60 * 10;

/** 채팅 서버 처리 중 문제가 발생했을 때 예외 처리 */
const unwrap = <T>(result: {
  data: T | null;
  error: { message: string } | null;
}) => {
  if (result.error) {
    throw new ServiceUnavailableError(
      `채팅 서버 처리 중 문제가 발생했습니다. (${result.error.message})`
    );
  }
  return result.data as T;
};

export const chatRepository = {
  /** 채팅 메시지 저장 */
  insertMessage: async (input: {
    estimateId: string;
    customerId: string;
    moverId: string;
    senderId: string;
    content?: string;
    imagePath?: string;
  }) => {
    const result = await supabase
      .from('chat_messages')
      .insert({
        estimate_id: input.estimateId,
        customer_id: input.customerId,
        mover_id: input.moverId,
        sender_id: input.senderId,
        content: input.content ?? null,
        image_url: input.imagePath ?? null,
      })
      .select()
      .single<ChatMessageRow>(); // 행 하나를 객체로 반환하도록 설정

    return unwrap(result);
  },

  /** 채팅 메시지 목록 조회
   * - 최신순(id desc)으로 size+1건을 가져와 cursorPagination과 같은 방식으로 다음 페이지 여부를 판단한다
   */
  listMessages: async (input: {
    estimateId: string;
    cursor?: string;
    size: number;
  }) => {
    let query = supabase
      .from('chat_messages')
      .select()
      .eq('estimate_id', input.estimateId) // 견적 ID 필터링 ,WHERE estimate_id = input.estimateId
      .order('id', { ascending: false }) // 최신순(id desc)으로 정렬, ORDER BY id DESC
      .limit(input.size + 1); // 한 페이지에 보여줄 건수 + 1건을 가져옴, LIMIT input.size + 1

    if (input.cursor) {
      query = query.lt('id', input.cursor);
    }

    const result = await query.overrideTypes<
      ChatMessageRow[],
      { merge: false }
    >();
    return unwrap(result) ?? [];
  },

  /** 채팅 메시지 읽음 처리 */
  markRead: async (input: { estimateId: string; readerId: string }) => {
    const result = await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('estimate_id', input.estimateId)
      .neq('sender_id', input.readerId) // 본인이 보낸 메시지는 읽음 처리하지 않음, WHERE sender_id != input.readerId
      .eq('is_read', false);

    if (result.error) {
      throw new ServiceUnavailableError(
        `채팅 서버 처리 중 문제가 발생했습니다. (${result.error.message})`
      );
    }
  },

  /** 채팅 메시지 읽지 않은 개수 조회 */
  countUnread: async (input: { estimateId: string; readerId: string }) => {
    const result = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('estimate_id', input.estimateId)
      .neq('sender_id', input.readerId)
      .eq('is_read', false);

    if (result.error) {
      throw new ServiceUnavailableError(
        `채팅 서버 처리 중 문제가 발생했습니다. (${result.error.message})`
      );
    }
    return result.count ?? 0;
  },

  /** 채팅방 목록용 — 방 하나의 마지막 메시지.
   * 방 전체를 한 쿼리로 긁어 클라이언트에서 추리면 PostgREST 기본 행 캡(Max Rows)에
   * 걸려 메시지 많은 유저는 조용히 틀어질 수 있어, 방마다 따로(병렬로) 조회한다.
   * chat_messages_room_cursor_idx(estimate_id, created_at desc, id desc)를 그대로 탄다.
   */
  getLastMessage: async (estimateId: string) => {
    const result = await supabase
      .from('chat_messages')
      .select()
      .eq('estimate_id', estimateId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle<ChatMessageRow>();

    return unwrap(result);
  },

  /** path가 이 채팅방 폴더에 실제 업로드된 파일인지 확인 (message에 끼워 넣기 전 검증용) */
  imageExists: async (estimateId: string, path: string) => {
    const folder = `${estimateId}/`;
    if (!path.startsWith(folder)) return false;

    const fileName = path.slice(folder.length);
    const result = await supabase.storage
      .from('chat-images')
      .list(estimateId, { search: fileName });

    const files = unwrap(result) ?? [];
    return files.some((file) => file.name === fileName);
  },

  /** path(들)에 대한 signed URL을 한 번에 발급한다. (버킷이 private라 영구 URL이 없음) */
  signImageUrls: async (paths: string[]) => {
    if (paths.length === 0) return new Map<string, string>();

    const result = await supabase.storage
      .from('chat-images')
      .createSignedUrls(paths, SIGNED_IMAGE_URL_TTL_SECONDS);

    const rows = unwrap(result) ?? [];
    const byPath = new Map<string, string>();
    for (const row of rows) {
      if (row.path && row.signedUrl) byPath.set(row.path, row.signedUrl);
    }
    return byPath;
  },

  /** 채팅 이미지 업로드 */
  createImageUploadUrl: async (input: {
    estimateId: string;
    fileName: string;
  }) => {
    // fileName은 스키마에서 확장자 형식만 검증했을 뿐 신뢰할 수 없으니,
    // 경로에는 절대 그대로 안 쓰고 확장자만 뽑아 붙인다.
    const extension = input.fileName.slice(input.fileName.lastIndexOf('.'));
    const path = `${input.estimateId}/${randomUUID()}${extension}`;
    const result = await supabase.storage
      .from('chat-images')
      .createSignedUploadUrl(path);

    return unwrap(result);
  },
};

export type { ChatMessageRow };
