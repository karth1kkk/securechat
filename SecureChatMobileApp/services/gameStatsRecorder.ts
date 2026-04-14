import { listGameInvites } from '../lib/chatGameWire';
import { isGameFinished, resultForCurrentUser } from '../lib/games/gameFinished';
import { ThreadMessage } from '../types/threadMessage';
import { gameStatsService } from './gameStatsService';

const recorded = new Set<string>();

/** Call when chat messages update so finished games update the local leaderboard once per game id. */
export function recordFinishedGameStats(messages: ThreadMessage[], currentUserId: string | undefined): void {
  if (!currentUserId) {
    return;
  }
  for (const inv of listGameInvites(messages)) {
    if (!isGameFinished(messages, inv)) {
      continue;
    }
    const key = `${inv.gameId}:${inv.kind}`;
    if (recorded.has(key)) {
      continue;
    }
    recorded.add(key);
    const res = resultForCurrentUser(messages, inv, currentUserId);
    if (!res) {
      continue;
    }
    if (inv.kind === 'tod') {
      void gameStatsService.record('tod', 'session');
    } else {
      void gameStatsService.record(inv.kind, res === 'win' ? 'win' : res === 'loss' ? 'loss' : 'draw');
    }
  }
}
