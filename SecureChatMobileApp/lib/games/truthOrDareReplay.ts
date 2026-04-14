import { parseChatGamePayload } from '../chatGameWire';
import { ThreadMessage } from '../../types/threadMessage';

export type TodReplay = {
  pickCount: number;
  ended: boolean;
};

export function replayTruthOrDare(messages: ThreadMessage[], gameId: string): TodReplay {
  let pickCount = 0;
  let ended = false;
  const chronological = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const m of chronological) {
    const p = parseChatGamePayload(m.content);
    if (!p || p.game !== 'tod' || p.gameId !== gameId) {
      continue;
    }
    if (p.action === 'invite') {
      continue;
    }
    if (p.action === 'end') {
      ended = true;
      break;
    }
    if (p.action === 'pick') {
      pickCount += 1;
    }
  }

  return { pickCount, ended };
}

export function todFinished(replay: TodReplay): boolean {
  return replay.ended;
}
