import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'securechat-game-leaderboard-v1';

export type GameKindKey = 'ttt' | 'dab' | 'tod';

export type WinLossDraw = {
  wins: number;
  losses: number;
  draws: number;
};

export type LeaderboardSnapshot = {
  ttt: WinLossDraw;
  dab: WinLossDraw;
  /** Completed Truth or dare sessions (ended with "End session"). */
  todSessions: number;
};

const emptyWld = (): WinLossDraw => ({ wins: 0, losses: 0, draws: 0 });

const defaultSnapshot = (): LeaderboardSnapshot => ({
  ttt: emptyWld(),
  dab: emptyWld(),
  todSessions: 0
});

export const gameStatsService = {
  async getSnapshot(): Promise<LeaderboardSnapshot> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) {
        return defaultSnapshot();
      }
      const parsed = JSON.parse(raw) as Partial<LeaderboardSnapshot>;
      const base = defaultSnapshot();
      return {
        ttt: { ...base.ttt, ...parsed.ttt },
        dab: { ...base.dab, ...parsed.dab },
        todSessions: typeof parsed.todSessions === 'number' ? parsed.todSessions : 0
      };
    } catch {
      return defaultSnapshot();
    }
  },

  async record(kind: GameKindKey, outcome: 'win' | 'loss' | 'draw' | 'session'): Promise<void> {
    const snap = await this.getSnapshot();
    if (kind === 'tod') {
      if (outcome === 'session') {
        snap.todSessions += 1;
      }
    } else if (outcome === 'win') {
      snap[kind].wins += 1;
    } else if (outcome === 'loss') {
      snap[kind].losses += 1;
    } else if (outcome === 'draw') {
      snap[kind].draws += 1;
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(snap));
  }
};
