import { ThreadMessage } from '../types/threadMessage';

export const CHAT_GAME_PREFIX = '__SC_GAME__:';

export type TicTacToeWirePayload = {
  v: 1;
  game: 'ttt';
  gameId: string;
  action: 'invite' | 'move';
  hostUserId?: string;
  cell?: number;
};

const normalizeUserId = (id: string | null | undefined) => (id ?? '').trim().toLowerCase();

export const sameUserId = (a: string | null | undefined, b: string | null | undefined) => {
  const na = normalizeUserId(a);
  const nb = normalizeUserId(b);
  return na.length > 0 && na === nb;
};

export function encodeGamePayload(payload: TicTacToeWirePayload): string {
  return CHAT_GAME_PREFIX + JSON.stringify(payload);
}

export function parseGamePayload(content: string): TicTacToeWirePayload | null {
  if (!content.startsWith(CHAT_GAME_PREFIX)) {
    return null;
  }
  try {
    const raw = content.slice(CHAT_GAME_PREFIX.length);
    const parsed = JSON.parse(raw) as TicTacToeWirePayload;
    if (parsed?.v !== 1 || parsed?.game !== 'ttt' || !parsed?.gameId) {
      return null;
    }
    if (parsed.action === 'invite') {
      if (typeof parsed.hostUserId !== 'string') {
        return null;
      }
    } else if (parsed.action === 'move') {
      const c = parsed.cell;
      if (typeof c !== 'number' || c < 0 || c > 8) {
        return null;
      }
    } else {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function summarizeGameMessage(content: string, isOutgoing: boolean): string | null {
  const g = parseGamePayload(content);
  if (!g) {
    return null;
  }
  if (g.action === 'invite') {
    return isOutgoing ? '🎮 You invited them to Tic-tac-toe' : '🎮 Invited you to Tic-tac-toe — tap 🎮 in the header to play';
  }
  return isOutgoing ? '🎮 You made a move (Tic-tac-toe)' : '🎮 They made a move (Tic-tac-toe)';
}

type Cell = 'X' | 'O' | null;

const LINES: [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

export const emptyBoard = (): Cell[] => Array<Cell>(9).fill(null);

export function checkOutcome(board: Cell[]): 'X' | 'O' | 'draw' | null {
  for (const [a, b, c] of LINES) {
    const v = board[a];
    if (v && v === board[b] && v === board[c]) {
      return v;
    }
  }
  if (board.every((cell) => cell !== null)) {
    return 'draw';
  }
  return null;
}

export function listTicTacToeGames(messages: ThreadMessage[]): { gameId: string; hostUserId: string }[] {
  const seen = new Map<string, string>();
  for (const m of messages) {
    const p = parseGamePayload(m.content);
    if (p?.action === 'invite' && p.hostUserId && m.senderId && sameUserId(p.hostUserId, m.senderId)) {
      seen.set(p.gameId, p.hostUserId);
    }
  }
  return Array.from(seen.entries()).map(([gameId, hostUserId]) => ({ gameId, hostUserId }));
}

export type TicTacToeReplay = {
  board: Cell[];
  nextMark: 'X' | 'O' | null;
  outcome: 'X' | 'O' | 'draw' | null;
};

export function replayTicTacToe(
  messages: ThreadMessage[],
  gameId: string,
  hostUserId: string
): TicTacToeReplay {
  const board = emptyBoard();
  const chronological = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const m of chronological) {
    const p = parseGamePayload(m.content);
    if (!p || p.gameId !== gameId) {
      continue;
    }
    if (p.action === 'invite') {
      continue;
    }
    if (p.action !== 'move' || !m.senderId) {
      continue;
    }
    const mark = sameUserId(m.senderId, hostUserId) ? 'X' : 'O';
    const xCount = board.filter((c) => c === 'X').length;
    const oCount = board.filter((c) => c === 'O').length;
    const expected: 'X' | 'O' = xCount === oCount ? 'X' : 'O';
    if (mark !== expected) {
      continue;
    }
    const cell = p.cell;
    if (cell === undefined || board[cell] !== null) {
      continue;
    }
    board[cell] = mark;
    if (checkOutcome(board)) {
      break;
    }
  }

  const outcome = checkOutcome(board);
  let nextMark: 'X' | 'O' | null = null;
  if (!outcome) {
    const xCount = board.filter((c) => c === 'X').length;
    const oCount = board.filter((c) => c === 'O').length;
    nextMark = xCount === oCount ? 'X' : 'O';
  }

  return { board, nextMark, outcome };
}
