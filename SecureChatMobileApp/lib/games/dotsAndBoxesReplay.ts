import { parseChatGamePayload } from '../chatGameWire';
import { ThreadMessage } from '../../types/threadMessage';
import { sameUserId } from '../userIds';

export type DabReplay = {
  rows: number;
  cols: number;
  takenEdges: Set<number>;
  scoreHost: number;
  scoreGuest: number;
  nextTurn: 'host' | 'guest' | null;
  /** null if still in progress */
  winner: 'host' | 'guest' | 'draw' | null;
  totalEdges: number;
  /** Who closed each box (for UI fill), null if not yet completed */
  boxOwners: ('host' | 'guest' | null)[][];
};

function gridCounts(rows: number, cols: number) {
  const hCount = (rows + 1) * cols;
  const vCount = rows * (cols + 1);
  return { hCount, vCount, total: hCount + vCount };
}

export function getDabGridFromMessages(messages: ThreadMessage[], gameId: string): { rows: number; cols: number } {
  const def = { rows: 3, cols: 3 };
  for (const m of messages) {
    const p = parseChatGamePayload(m.content);
    if (p?.game === 'dab' && p.gameId === gameId && p.action === 'invite') {
      const r = typeof p.rows === 'number' && p.rows >= 2 && p.rows <= 5 ? p.rows : def.rows;
      const c = typeof p.cols === 'number' && p.cols >= 2 && p.cols <= 5 ? p.cols : def.cols;
      return { rows: r, cols: c };
    }
  }
  return def;
}

function squareEdges(
  sr: number,
  sc: number,
  rows: number,
  cols: number,
  hCount: number
): [number, number, number, number] {
  const top = sr * cols + sc;
  const bottom = (sr + 1) * cols + sc;
  const left = hCount + sr * (cols + 1) + sc;
  const right = hCount + sr * (cols + 1) + sc + 1;
  return [top, bottom, left, right];
}

function newlyCompletedSquares(
  edge: number,
  before: Set<number>,
  rows: number,
  cols: number,
  hCount: number
): { sr: number; sc: number }[] {
  const after = new Set(before);
  after.add(edge);
  const list: { sr: number; sc: number }[] = [];
  for (let sr = 0; sr < rows; sr += 1) {
    for (let sc = 0; sc < cols; sc += 1) {
      const [t, b, l, r] = squareEdges(sr, sc, rows, cols, hCount);
      const completeNow = after.has(t) && after.has(b) && after.has(l) && after.has(r);
      const completeBefore = before.has(t) && before.has(b) && before.has(l) && before.has(r);
      if (completeNow && !completeBefore) {
        list.push({ sr, sc });
      }
    }
  }
  return list;
}

export function gridCountsPublic(rows: number, cols: number) {
  return gridCounts(rows, cols);
}

/** Horizontal edge between dots (hr, hc) and (hr, hc+1); hr in [0, rows], hc in [0, cols-1]. */
export function horizontalEdgeId(hr: number, hc: number, cols: number): number {
  return hr * cols + hc;
}

/** Vertical edge between dots (vr, vc) and (vr+1, vc); vr in [0, rows-1], vc in [0, cols]. */
export function verticalEdgeId(vr: number, vc: number, rows: number, cols: number, hCount: number): number {
  return hCount + vr * (cols + 1) + vc;
}

export function replayDotsAndBoxes(
  messages: ThreadMessage[],
  gameId: string,
  hostUserId: string
): DabReplay {
  const { rows, cols } = getDabGridFromMessages(messages, gameId);
  const { hCount, total } = gridCounts(rows, cols);

  const chronological = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const takenEdges = new Set<number>();
  const boxOwners: ('host' | 'guest' | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );
  let scoreHost = 0;
  let scoreGuest = 0;
  let turn: 'host' | 'guest' = 'host';

  for (const m of chronological) {
    const p = parseChatGamePayload(m.content);
    if (!p || p.game !== 'dab' || p.gameId !== gameId) {
      continue;
    }
    if (p.action === 'invite') {
      continue;
    }
    if (p.action !== 'move' || !m.senderId) {
      continue;
    }
    const role = sameUserId(m.senderId, hostUserId) ? 'host' : 'guest';
    if (role !== turn) {
      continue;
    }
    const edge = p.edge;
    if (edge < 0 || edge >= total || takenEdges.has(edge)) {
      continue;
    }

    const before = new Set(takenEdges);
    takenEdges.add(edge);
    const completed = newlyCompletedSquares(edge, before, rows, cols, hCount);
    const newBoxes = completed.length;
    for (const { sr, sc } of completed) {
      boxOwners[sr][sc] = role;
    }
    if (newBoxes > 0) {
      if (role === 'host') {
        scoreHost += newBoxes;
      } else {
        scoreGuest += newBoxes;
      }
      turn = role;
    } else {
      turn = role === 'host' ? 'guest' : 'host';
    }

    if (takenEdges.size >= total) {
      break;
    }
  }

  const done = takenEdges.size >= total;
  let winner: 'host' | 'guest' | 'draw' | null = null;
  let nextTurn: 'host' | 'guest' | null = turn;

  if (done) {
    winner =
      scoreHost > scoreGuest ? 'host' : scoreGuest > scoreHost ? 'guest' : 'draw';
    nextTurn = null;
  }

  return {
    rows,
    cols,
    takenEdges,
    scoreHost,
    scoreGuest,
    nextTurn,
    winner,
    totalEdges: total,
    boxOwners
  };
}

export function dabFinished(replay: DabReplay): boolean {
  return replay.winner !== null || replay.takenEdges.size >= replay.totalEdges;
}
