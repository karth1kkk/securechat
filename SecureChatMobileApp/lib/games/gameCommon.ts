import { ThreadMessage } from '../../types/threadMessage';
import { parseChatGamePayload } from '../chatGameWire';

export function chronologicalMessages(messages: ThreadMessage[]): ThreadMessage[] {
  return [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function messagesForGame(messages: ThreadMessage[], gameId: string): ThreadMessage[] {
  return chronologicalMessages(messages).filter((m) => {
    const p = parseChatGamePayload(m.content);
    return p && p.gameId === gameId;
  });
}
