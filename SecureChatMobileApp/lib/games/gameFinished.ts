import { GameInvite, listGameInvites } from '../chatGameWire';
import { ThreadMessage } from '../../types/threadMessage';
import { dabFinished, replayDotsAndBoxes } from './dotsAndBoxesReplay';
import { replayTicTacToe, tttFinished } from './ticTacToeReplay';
import { replayTruthOrDare, todFinished } from './truthOrDareReplay';

export function isGameFinished(messages: ThreadMessage[], inv: GameInvite): boolean {
  const { gameId, hostUserId, kind } = inv;
  switch (kind) {
    case 'ttt':
      return tttFinished(replayTicTacToe(messages, gameId, hostUserId));
    case 'dab':
      return dabFinished(replayDotsAndBoxes(messages, gameId, hostUserId));
    case 'tod':
      return todFinished(replayTruthOrDare(messages, gameId));
    default:
      return false;
  }
}

export function listActiveGameInvites(messages: ThreadMessage[]): GameInvite[] {
  return listGameInvites(messages).filter((inv) => !isGameFinished(messages, inv));
}

export type GameResultMe = 'win' | 'loss' | 'draw' | 'session';

export function resultForCurrentUser(
  messages: ThreadMessage[],
  inv: GameInvite,
  currentUserId: string | undefined
): GameResultMe | null {
  if (!currentUserId || !isGameFinished(messages, inv)) {
    return null;
  }
  const { gameId, hostUserId, kind } = inv;
  const iAmHost = hostUserId.trim().toLowerCase() === currentUserId.trim().toLowerCase();

  switch (kind) {
    case 'ttt': {
      const r = replayTicTacToe(messages, gameId, hostUserId);
      if (!r.outcome || r.outcome === 'draw') {
        return 'draw';
      }
      const hostWon = r.outcome === 'X';
      if (hostWon) {
        return iAmHost ? 'win' : 'loss';
      }
      return iAmHost ? 'loss' : 'win';
    }
    case 'dab': {
      const r = replayDotsAndBoxes(messages, gameId, hostUserId);
      if (!r.winner || r.winner === 'draw') {
        return 'draw';
      }
      if (r.winner === 'host') {
        return iAmHost ? 'win' : 'loss';
      }
      return iAmHost ? 'loss' : 'win';
    }
    case 'tod':
      return 'session';
    default:
      return null;
  }
}
