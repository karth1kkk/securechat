import { parseChatGamePayload } from '../chatGameWire';
import { ThreadMessage } from '../../types/threadMessage';
import { sameUserId } from '../userIds';

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

export type TicTacToeReplay = {
  board: Cell[];
  nextMark: 'X' | 'O' | null;
  outcome: 'X' | 'O' | 'draw' | null;
};

export function replayTicTacToe(messages: ThreadMessage[], gameId: string, hostUserId: string): TicTacToeReplay {
  const board = emptyBoard();
  const chronological = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const m of chronological) {
    const p = parseChatGamePayload(m.content);
    if (!p || p.game !== 'ttt' || p.gameId !== gameId) {
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
    if (board[cell] !== null) {
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

export function tttFinished(replay: TicTacToeReplay): boolean {
  return replay.outcome !== null;
}
