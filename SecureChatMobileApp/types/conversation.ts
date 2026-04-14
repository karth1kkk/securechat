export type ConversationParticipant = {
  userId: string;
  publicKey?: string | null;
  sessionId?: string | null;
  username?: string | null;
};

export type ConversationRecord = {
  id: string;
  isGroup?: boolean;
  createdAt: string;
  lastMessageAt?: string | null;
  participants: ConversationParticipant[];
};
