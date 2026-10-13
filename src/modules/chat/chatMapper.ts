import type { ChatMessageRow } from './chatRepository';

export const chatMapper = {
  toMessage: (row: ChatMessageRow) => ({
    messageId: String(row.id),
    senderId: row.sender_id,
    content: row.content,
    imageUrl: row.image_url,
    isRead: row.is_read,
    createdAt: row.created_at,
  }),

  toRoom: (room: {
    estimateId: string;
    otherParty: { id: string; name: string; imgUrl: string | null };
    lastMessage: ChatMessageRow | null;
    unreadCount: number;
  }) => ({
    estimateId: room.estimateId,
    otherParty: room.otherParty,
    lastMessage: room.lastMessage
      ? chatMapper.toMessage(room.lastMessage)
      : null,
    unreadCount: room.unreadCount,
  }),
};
