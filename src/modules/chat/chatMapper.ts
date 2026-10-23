import type { ChatMessageRow } from './chatRepository';

export const chatMapper = {
  toMessage: (row: ChatMessageRow) => ({
    messageId: row.id,
    estimateId: row.estimateId,
    senderId: row.senderId,
    content: row.content,
    imageUrl: row.imagePath,
    isRead: row.isRead,
    createdAt: row.createdAt,
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
