import { ThreadMessage } from '../types/threadMessage';
import { sameUserId } from './userIds';

export const CHAT_GAME_PREFIX = '__SC_GAME__:';

export type GameKind = 'ttt' | 'dab' | 'tod';

export type ChatGameWire =
  | { v: 1; game: 'ttt'; gameId: string; action: 'invite'; hostUserId: string }
  | { v: 1; game: 'ttt'; gameId: string; action: 'move'; cell: number }
  | { v: 1; game: 'dab'; gameId: string; action: 'invite'; hostUserId: string; rows?: number; cols?: number }
  | { v: 1; game: 'dab'; gameId: string; action: 'move'; edge: number }
  | { v: 1; game: 'tod'; gameId: string; action: 'invite'; hostUserId: string }
  | { v: 1; game: 'tod'; gameId: string; action: 'pick'; choice: 'truth' | 'dare' }
  | { v: 1; game: 'tod'; gameId: string; action: 'end' };

export type GameInvite = { gameId: string; hostUserId: string; kind: GameKind };

export function encodeChatGamePayload(payload: ChatGameWire): string {
  return CHAT_GAME_PREFIX + JSON.stringify(payload);
}

export function parseChatGamePayload(content: string): ChatGameWire | null {
  if (!content.startsWith(CHAT_GAME_PREFIX)) {
    return null;
  }
  try {
    const raw = content.slice(CHAT_GAME_PREFIX.length);
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (p.v !== 1 || typeof p.gameId !== 'string' || typeof p.game !== 'string') {
      return null;
    }
    const gid = p.gameId as string;
    switch (p.game) {
      case 'ttt':
        return parseTtt(p, gid);
      case 'dab':
        return parseDab(p, gid);
      case 'tod':
        return parseTod(p, gid);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function parseTtt(p: Record<string, unknown>, gameId: string): ChatGameWire | null {
  if (p.action === 'invite' && typeof p.hostUserId === 'string') {
    return { v: 1, game: 'ttt', gameId, action: 'invite', hostUserId: p.hostUserId };
  }
  if (p.action === 'move' && typeof p.cell === 'number' && p.cell >= 0 && p.cell <= 8) {
    return { v: 1, game: 'ttt', gameId, action: 'move', cell: p.cell };
  }
  return null;
}

function parseDab(p: Record<string, unknown>, gameId: string): ChatGameWire | null {
  if (p.action === 'invite' && typeof p.hostUserId === 'string') {
    return {
      v: 1,
      game: 'dab',
      gameId,
      action: 'invite',
      hostUserId: p.hostUserId,
      rows: typeof p.rows === 'number' ? p.rows : undefined,
      cols: typeof p.cols === 'number' ? p.cols : undefined
    };
  }
  if (p.action === 'move' && typeof p.edge === 'number' && p.edge >= 0) {
    return { v: 1, game: 'dab', gameId, action: 'move', edge: p.edge };
  }
  return null;
}

function parseTod(p: Record<string, unknown>, gameId: string): ChatGameWire | null {
  if (p.action === 'invite' && typeof p.hostUserId === 'string') {
    return { v: 1, game: 'tod', gameId, action: 'invite', hostUserId: p.hostUserId };
  }
  if (p.action === 'pick') {
    const c = p.choice;
    if (c === 'truth' || c === 'dare') {
      return { v: 1, game: 'tod', gameId, action: 'pick', choice: c };
    }
  }
  if (p.action === 'end') {
    return { v: 1, game: 'tod', gameId, action: 'end' };
  }
  return null;
}

const LABELS: Record<GameKind, string> = {
  ttt: 'Tic-tac-toe',
  dab: 'Dots & Boxes',
  tod: 'Truth or dare'
};

export function summarizeChatGameMessage(content: string, isOutgoing: boolean): string | null {
  const g = parseChatGamePayload(content);
  if (!g) {
    return null;
  }
  const name = LABELS[g.game];
  if (g.action === 'invite') {
    return isOutgoing ? `🎮 You invited them to ${name}` : `🎮 Invited you to ${name} — open 🎮 in the header`;
  }
  if (g.game === 'tod' && g.action === 'end') {
    return isOutgoing ? '🎮 You ended Truth or dare' : '🎮 They ended Truth or dare';
  }
  if (g.game === 'tod' && g.action === 'pick') {
    return isOutgoing ? `🎮 You chose ${g.choice} (Truth or dare)` : `🎮 They chose ${g.choice} (Truth or dare)`;
  }
  return isOutgoing ? `🎮 You made a move (${name})` : `🎮 They made a move (${name})`;
}

export function listGameInvites(messages: ThreadMessage[]): GameInvite[] {
  const seen = new Map<string, GameInvite>();
  for (const m of messages) {
    const p = parseChatGamePayload(m.content);
    if (!p || p.action !== 'invite' || !m.senderId) {
      continue;
    }
    if (!sameUserId(p.hostUserId, m.senderId)) {
      continue;
    }
    seen.set(p.gameId, { gameId: p.gameId, hostUserId: p.hostUserId, kind: p.game });
  }
  return Array.from(seen.values());
}
