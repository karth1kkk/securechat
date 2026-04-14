import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { ChatGameWire, GameKind, encodeChatGamePayload, parseChatGamePayload, summarizeChatGameMessage } from '../lib/chatGameWire';
import { sameUserId } from '../lib/userIds';
import { replayTicTacToe } from '../lib/games/ticTacToeReplay';
import { replayDotsAndBoxes } from '../lib/games/dotsAndBoxesReplay';
import { replayTruthOrDare } from '../lib/games/truthOrDareReplay';
import { listActiveGameInvites } from '../lib/games/gameFinished';
import { ThemePalette, useTheme } from '../theme/ThemeContext';
import { ThreadMessage } from '../types/threadMessage';
import { DotsAndBoxesBoard } from './DotsAndBoxesBoard';

export type ChatGameModalProps = {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  messages: ThreadMessage[];
  currentUserId: string | undefined;
  sendPlaintext: (plain: string) => Promise<void>;
};

const GAME_LABELS: Record<GameKind, string> = {
  ttt: 'Tic-tac-toe',
  dab: 'Dots & Boxes',
  tod: 'Truth or dare'
};

const newGameId = (kind: GameKind) => `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/** Presets: rows × cols = number of boxes in each direction (wire format matches replay). */
const DAB_GRID_PRESETS: { label: string; rows: number; cols: number; hint?: string }[] = [
  { label: '3 × 3', rows: 3, cols: 3, hint: 'Classic' },
  { label: '4 × 4', rows: 4, cols: 4, hint: 'Medium' },
  { label: '5 × 5', rows: 5, cols: 5, hint: 'Large' },
  { label: '2 × 2', rows: 2, cols: 2, hint: 'Quick' },
  { label: '3 × 4', rows: 3, cols: 4, hint: 'Rectangle' },
  { label: '4 × 3', rows: 4, cols: 3, hint: 'Rectangle' }
];

type ActiveSession = { gameId: string; kind: GameKind };

export const ChatGameModal: React.FC<ChatGameModalProps> = ({
  visible,
  onClose,
  conversationId,
  messages,
  currentUserId,
  sendPlaintext
}) => {
  const { palette } = useTheme();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [dabGridPickerOpen, setDabGridPickerOpen] = useState(false);

  const activeInvites = useMemo(() => listActiveGameInvites(messages), [messages]);

  useEffect(() => {
    if (!visible) {
      setDabGridPickerOpen(false);
    }
  }, [visible]);

  const hostForSession = useMemo(() => {
    if (!session) {
      return null;
    }
    const fromList = activeInvites.find((i) => i.gameId === session.gameId)?.hostUserId;
    if (fromList) {
      return fromList;
    }
    for (const m of messages) {
      const p = parseChatGamePayload(m.content);
      if (p && p.gameId === session.gameId && p.action === 'invite' && 'hostUserId' in p) {
        return (p as { hostUserId: string }).hostUserId;
      }
    }
    return null;
  }, [session, activeInvites, messages]);

  const startInvite = async (kind: GameKind) => {
    if (!currentUserId) {
      return;
    }
    const gameId = newGameId(kind);
    const base: ChatGameWire = { v: 1, game: kind, gameId, action: 'invite', hostUserId: currentUserId };
    await sendPlaintext(encodeChatGamePayload(base));
    setSession({ gameId, kind });
  };

  const startDabInvite = async (rows: number, cols: number) => {
    if (!currentUserId) {
      return;
    }
    const gameId = newGameId('dab');
    const payload: ChatGameWire = {
      v: 1,
      game: 'dab',
      gameId,
      action: 'invite',
      hostUserId: currentUserId,
      rows,
      cols
    };
    await sendPlaintext(encodeChatGamePayload(payload));
    setDabGridPickerOpen(false);
    setSession({ gameId, kind: 'dab' });
  };

  const incoming = activeInvites.filter((g) => currentUserId && !sameUserId(currentUserId, g.hostUserId));
  const mine = activeInvites.filter((g) => currentUserId && sameUserId(currentUserId, g.hostUserId));

  const renderPlay = () => {
    if (!session || !hostForSession) {
      return null;
    }
    const kind = session.kind;
    const gid = session.gameId;
    const hu = hostForSession;

    if (kind === 'ttt') {
      return (
        <TttPanel
          messages={messages}
          gameId={gid}
          hostUserId={hu}
          currentUserId={currentUserId}
          palette={palette}
          sendPlaintext={sendPlaintext}
        />
      );
    }
    if (kind === 'dab') {
      return (
        <DabPanel
          messages={messages}
          gameId={gid}
          hostUserId={hu}
          currentUserId={currentUserId}
          palette={palette}
          sendPlaintext={sendPlaintext}
        />
      );
    }
    return (
      <TodPanel
        messages={messages}
        gameId={gid}
        hostUserId={hu}
        currentUserId={currentUserId}
        palette={palette}
        sendPlaintext={sendPlaintext}
      />
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Dismiss game" />
        <View
          className="rounded-t-3xl px-4 pb-8 pt-4"
          style={{
            backgroundColor: palette.background,
            borderTopWidth: 1,
            borderColor: palette.border,
            maxHeight: '92%'
          }}
        >
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-semibold" style={{ color: palette.text }}>
              {session ? GAME_LABELS[session.kind] : 'Games'}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text className="text-base font-semibold" style={{ color: palette.action }}>
                Done
              </Text>
            </Pressable>
          </View>

          <Text className="mb-3 text-center text-xs" style={{ color: palette.muted }}>
            Encrypted chat messages · Live updates over SignalR while this chat is open ({conversationId.slice(0, 6)}…).
          </Text>

          {!session ? (
            <ScrollView>
              {dabGridPickerOpen ? (
                <View className="mb-2">
                  <Pressable className="mb-3 self-start py-1" onPress={() => setDabGridPickerOpen(false)}>
                    <Text style={{ color: palette.action }}>← Back</Text>
                  </Pressable>
                  <Text className="mb-1 text-base font-semibold" style={{ color: palette.text }}>
                    Dots and Boxes — grid size
                  </Text>
                  <Text className="mb-4 text-sm leading-5" style={{ color: palette.muted }}>
                    Choose how many boxes wide and tall (e.g. 3×3 is a classic small board). Your opponent sees
                    the same size from the invite.
                  </Text>
                  {DAB_GRID_PRESETS.map((p) => (
                    <Pressable
                      key={`${p.rows}x${p.cols}`}
                      className="mb-2 flex-row items-center justify-between rounded-xl border px-4 py-3.5"
                      style={{ borderColor: palette.border, backgroundColor: palette.card }}
                      onPress={() => void startDabInvite(p.rows, p.cols)}
                    >
                      <Text className="text-base font-semibold" style={{ color: palette.text }}>
                        {p.label}
                      </Text>
                      {p.hint ? (
                        <Text className="text-sm" style={{ color: palette.muted }}>
                          {p.hint}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              ) : (
                <>
                  <Text className="mb-2 text-sm font-semibold" style={{ color: palette.text }}>
                    Start a game
                  </Text>
                  {(Object.keys(GAME_LABELS) as GameKind[]).map((k) => (
                    <Pressable
                      key={k}
                      className="mb-2 rounded-xl py-3"
                      style={{ backgroundColor: palette.action }}
                      onPress={() => {
                        if (k === 'dab') {
                          setDabGridPickerOpen(true);
                        } else {
                          void startInvite(k);
                        }
                      }}
                    >
                      <Text className="text-center font-semibold text-white">New {GAME_LABELS[k]}</Text>
                    </Pressable>
                  ))}
                </>
              )}
              {!dabGridPickerOpen && incoming.length > 0 ? (
                <>
                  <Text className="mb-2 mt-4 text-sm font-semibold" style={{ color: palette.text }}>
                    Join a game
                  </Text>
                  {incoming.map((g) => (
                    <Pressable
                      key={`${g.kind}-${g.gameId}`}
                      className="mb-2 rounded-xl border px-3 py-3"
                      style={{ borderColor: palette.border, backgroundColor: palette.card }}
                      onPress={() => setSession({ gameId: g.gameId, kind: g.kind })}
                    >
                      <Text style={{ color: palette.text }}>
                        {GAME_LABELS[g.kind]} · …{g.gameId.slice(-8)}
                      </Text>
                    </Pressable>
                  ))}
                </>
              ) : null}
              {!dabGridPickerOpen && mine.length > 0 ? (
                <>
                  <Text className="mb-2 mt-4 text-sm font-semibold" style={{ color: palette.text }}>
                    Your games (in progress)
                  </Text>
                  {mine.map((g) => (
                    <Pressable
                      key={`mine-${g.kind}-${g.gameId}`}
                      className="mb-2 rounded-xl border px-3 py-3"
                      style={{ borderColor: palette.border, backgroundColor: palette.card }}
                      onPress={() => setSession({ gameId: g.gameId, kind: g.kind })}
                    >
                      <Text style={{ color: palette.text }}>
                        {GAME_LABELS[g.kind]} · …{g.gameId.slice(-8)}
                      </Text>
                    </Pressable>
                  ))}
                </>
              ) : null}
            </ScrollView>
          ) : (
            <View>
              <Pressable className="mb-3 self-start" onPress={() => setSession(null)}>
                <Text style={{ color: palette.action }}>← All games</Text>
              </Pressable>
              {renderPlay()}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

function TttPanel({
  messages,
  gameId,
  hostUserId,
  currentUserId,
  palette,
  sendPlaintext
}: {
  messages: ThreadMessage[];
  gameId: string;
  hostUserId: string;
  currentUserId: string | undefined;
  palette: ThemePalette;
  sendPlaintext: (s: string) => Promise<void>;
}) {
  const replay = useMemo(() => replayTicTacToe(messages, gameId, hostUserId), [messages, gameId, hostUserId]);
  const myMark = sameUserId(currentUserId, hostUserId) ? 'X' : 'O';
  const myTurn = !replay.outcome && replay.nextMark === myMark;
  const cellSize = 80;
  const handle = (i: number) => {
    if (!myTurn || replay.outcome || replay.board[i]) {
      return;
    }
    void sendPlaintext(
      encodeChatGamePayload({ v: 1, game: 'ttt', gameId, action: 'move', cell: i })
    );
  };
  return (
    <View className="items-center">
      <Text className="mb-2 text-sm" style={{ color: palette.muted }}>
        {replay.outcome
          ? replay.outcome === 'draw'
            ? 'Draw.'
            : (replay.outcome === 'X') === sameUserId(currentUserId, hostUserId)
              ? 'You won'
              : 'They won'
          : myTurn
            ? 'Your turn'
            : "Their turn"}
      </Text>
      <View className="rounded-[18px] border p-2" style={{ borderColor: palette.border, backgroundColor: palette.card }}>
        {[0, 1, 2].map((row) => (
          <View key={row} className="mb-1 flex-row">
            {[0, 1, 2].map((col) => {
              const i = row * 3 + col;
              return (
                <Pressable
                  key={i}
                  disabled={!myTurn || !!replay.outcome}
                  onPress={() => handle(i)}
                  className="mr-1 items-center justify-center rounded-lg border"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    borderColor: palette.border,
                    backgroundColor: palette.surface
                  }}
                >
                  <Text className="text-4xl font-bold" style={{ color: replay.board[i] === 'X' ? palette.action : palette.text }}>
                    {replay.board[i] ?? ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function DabPanel({
  messages,
  gameId,
  hostUserId,
  currentUserId,
  palette,
  sendPlaintext
}: {
  messages: ThreadMessage[];
  gameId: string;
  hostUserId: string;
  currentUserId: string | undefined;
  palette: ThemePalette;
  sendPlaintext: (s: string) => Promise<void>;
}) {
  const replay = useMemo(() => replayDotsAndBoxes(messages, gameId, hostUserId), [messages, gameId, hostUserId]);
  const { rows, cols } = replay;
  const myTurn =
    replay.winner === null &&
    replay.nextTurn &&
    currentUserId &&
    (replay.nextTurn === 'host' ? sameUserId(currentUserId, hostUserId) : !sameUserId(currentUserId, hostUserId));

  const tapEdge = (e: number) => {
    if (!myTurn || replay.takenEdges.has(e)) {
      return;
    }
    void sendPlaintext(encodeChatGamePayload({ v: 1, game: 'dab', gameId, action: 'move', edge: e }));
  };

  const you = sameUserId(currentUserId, hostUserId) ? replay.scoreHost : replay.scoreGuest;
  const them = sameUserId(currentUserId, hostUserId) ? replay.scoreGuest : replay.scoreHost;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
      <Text className="mb-1 text-center text-base font-semibold" style={{ color: palette.text }}>
        {replay.winner
          ? replay.winner === 'draw'
            ? 'Tie game'
            : replay.winner === 'host'
              ? sameUserId(currentUserId, hostUserId)
                ? 'You won'
                : 'They won'
              : sameUserId(currentUserId, hostUserId)
                ? 'They won'
                : 'You won'
          : myTurn
            ? 'Your turn — tap a line'
            : "Their turn"}
      </Text>
      <Text className="mb-4 text-center text-sm" style={{ color: palette.muted }}>
        You {you} · {them} them · {rows}×{cols} grid
      </Text>
      <View
        className="rounded-2xl border p-3"
        style={{ borderColor: palette.border, backgroundColor: palette.card }}
      >
        <DotsAndBoxesBoard
          rows={rows}
          cols={cols}
          takenEdges={replay.takenEdges}
          boxOwners={replay.boxOwners}
          palette={palette}
          iAmHost={!!currentUserId && sameUserId(currentUserId, hostUserId)}
          myTurn={!!myTurn}
          gameOver={replay.winner !== null}
          onEdgePress={tapEdge}
        />
      </View>
    </ScrollView>
  );
}

function TodPanel({
  messages,
  gameId,
  palette,
  sendPlaintext
}: {
  messages: ThreadMessage[];
  gameId: string;
  hostUserId: string;
  currentUserId: string | undefined;
  palette: ThemePalette;
  sendPlaintext: (s: string) => Promise<void>;
}) {
  const replay = useMemo(() => replayTruthOrDare(messages, gameId), [messages, gameId]);
  const end = () =>
    void sendPlaintext(encodeChatGamePayload({ v: 1, game: 'tod', gameId, action: 'end' }));
  const pick = (c: 'truth' | 'dare') =>
    void sendPlaintext(encodeChatGamePayload({ v: 1, game: 'tod', gameId, action: 'pick', choice: c }));

  return (
    <View>
      <Text className="mb-1 text-sm" style={{ color: palette.muted }}>
        Picks this session: {replay.pickCount}
        {replay.ended ? ' · ended' : ''}
      </Text>
      <Text className="mb-3 text-sm" style={{ color: palette.muted }}>
        Take turns choosing truth or dare and follow up in chat. Tap End when you are done playing.
      </Text>
      <Pressable className="mb-2 rounded-xl py-3" style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border }} onPress={() => pick('truth')}>
        <Text className="text-center font-semibold" style={{ color: palette.text }}>
          I pick: Truth
        </Text>
      </Pressable>
      <Pressable className="mb-4 rounded-xl py-3" style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border }} onPress={() => pick('dare')}>
        <Text className="text-center font-semibold" style={{ color: palette.text }}>
          I pick: Dare
        </Text>
      </Pressable>
      <Pressable className="rounded-xl py-3" style={{ backgroundColor: '#b91c1c' }} onPress={end}>
        <Text className="text-center font-semibold text-white">End Truth or dare session</Text>
      </Pressable>
    </View>
  );
}

export function bubbleTextForMessage(item: ThreadMessage): string {
  const s = summarizeChatGameMessage(item.content, item.isOutgoing);
  if (s) {
    return s;
  }
  const g = parseChatGamePayload(item.content);
  if (g) {
    return item.isOutgoing ? '🎮 Game message sent' : '🎮 Game message';
  }
  return item.content;
}
