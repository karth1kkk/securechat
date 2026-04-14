export interface ThreadMessage {
  id: string;
  content: string;
  isOutgoing: boolean;
  /** Present when known (server or optimistic); required for multiplayer game replay. */
  senderId?: string;
  createdAt: string;
  status?: 'sending' | 'sent';
}
