import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import {
  encodeGamePayload,
  listTicTacToeGames,
  parseGamePayload,
  replayTicTacToe,
  sameUserId,
  summarizeGameMessage
} from '../lib/chatGameProtocol';
import { ThreadMessage } from '../types/threadMessage';

export type TicTacToeChatModalProps = {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  messages: ThreadMessage[];
  currentUserId: string | undefined;
  /** Send plaintext through the same encrypted chat channel as normal messages */
  sendPlaintext: (plain: string) => Promise<void>;
};

const newGameId = () => `ttt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const TicTacToeChatModal: React.FC<TicTacToeChatModalProps> = ({
  visible,
  onClose,
  conversationId,
  messages,
  currentUserId,
  sendPlaintext
}) => {
  const { palette } = useTheme();
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const games = useMemo(() => listTicTacToeGames(messages), [messages]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (selectedGameId && !games.some((g) => g.gameId === selectedGameId)) {
      setSelectedGameId(null);
    }
  }, [visible, games, selectedGameId]);

  const hostUserIdForSelection = useMemo(() => {
    if (!selectedGameId) {
      return null;
    }
    return games.find((g) => g.gameId === selectedGameId)?.hostUserId ?? null;
  }, [games, selectedGameId]);

  const replay = useMemo(() => {
    if (!selectedGameId || !hostUserIdForSelection) {
      return null;
    }
    return replayTicTacToe(messages, selectedGameId, hostUserIdForSelection);
  }, [messages, selectedGameId, hostUserIdForSelection]);

  const myMark = useMemo<'X' | 'O' | null>(() => {
    if (!currentUserId || !hostUserIdForSelection) {
      return null;
    }
    return sameUserId(currentUserId, hostUserIdForSelection) ? 'X' : 'O';
  }, [currentUserId, hostUserIdForSelection]);

  const myTurn = useMemo(() => {
    if (!replay || replay.outcome) {
      return false;
    }
    if (!replay.nextMark || !myMark) {
      return false;
    }
    return replay.nextMark === myMark;
  }, [replay, myMark]);

  const statusLine = useMemo(() => {
    if (!replay) {
      return 'Pick a game or start a new one.';
    }
    if (replay.outcome === 'draw') {
      return 'Draw.';
    }
    if (replay.outcome) {
      const iAmHost = sameUserId(currentUserId, hostUserIdForSelection);
      const hostWins = replay.outcome === 'X';
      if (hostWins) {
        return iAmHost ? 'You won' : 'They won';
      }
      return iAmHost ? 'They won' : 'You won';
    }
    if (!myTurn) {
      return "Opponent's turn…";
    }
    return 'Your turn';
  }, [replay, myTurn, currentUserId, hostUserIdForSelection]);

  const handleStartNew = useCallback(async () => {
    if (!currentUserId) {
      return;
    }
    const gameId = newGameId();
    const payload = encodeGamePayload({
      v: 1,
      game: 'ttt',
      gameId,
      action: 'invite',
      hostUserId: currentUserId
    });
    await sendPlaintext(payload);
    setSelectedGameId(gameId);
  }, [currentUserId, sendPlaintext]);

  const handleMove = useCallback(
    async (cell: number) => {
      if (!selectedGameId || !myTurn || !replay || replay.outcome || replay.board[cell] !== null) {
        return;
      }
      const payload = encodeGamePayload({
        v: 1,
        game: 'ttt',
        gameId: selectedGameId,
        action: 'move',
        cell
      });
      await sendPlaintext(payload);
    },
    [selectedGameId, myTurn, replay, sendPlaintext]
  );

  const incomingInvites = useMemo(() => {
    return games.filter((g) => !sameUserId(currentUserId, g.hostUserId));
  }, [games, currentUserId]);

  const cellSize = 88;

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
            maxHeight: '88%'
          }}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-semibold" style={{ color: palette.text }}>
              Tic-tac-toe
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text className="text-base font-semibold" style={{ color: palette.action }}>
                Done
              </Text>
            </Pressable>
          </View>

          <Text className="mb-3 text-center text-sm" style={{ color: palette.muted }}>
            Real time while this chat is open: moves push over SignalR as soon as they are sent, then stay in the
            encrypted history like any message ({conversationId.slice(0, 6)}…).
          </Text>

          {!selectedGameId ? (
            <View>
              <Pressable
                className="mb-4 items-center rounded-xl py-3"
                style={{ backgroundColor: palette.action }}
                onPress={() => void handleStartNew()}
              >
                <Text className="font-semibold text-white">Start new game (you are X)</Text>
              </Pressable>
              {incomingInvites.length > 0 ? (
                <Text className="mb-2 text-sm font-medium" style={{ color: palette.text }}>
                  Join a game
                </Text>
              ) : null}
              {incomingInvites.map((g) => (
                <Pressable
                  key={g.gameId}
                  className="mb-2 rounded-xl border px-4 py-3"
                  style={{ borderColor: palette.border, backgroundColor: palette.card }}
                  onPress={() => setSelectedGameId(g.gameId)}
                >
                  <Text style={{ color: palette.text }}>Game {g.gameId.slice(-8)} — you play O</Text>
                </Pressable>
              ))}
              {games.length > 0 ? (
                <>
                  <Text className="mb-2 mt-4 text-sm font-medium" style={{ color: palette.text }}>
                    Your games
                  </Text>
                  {games
                    .filter((g) => sameUserId(currentUserId, g.hostUserId))
                    .map((g) => (
                      <Pressable
                        key={g.gameId}
                        className="mb-2 rounded-xl border px-4 py-3"
                        style={{ borderColor: palette.border, backgroundColor: palette.card }}
                        onPress={() => setSelectedGameId(g.gameId)}
                      >
                        <Text style={{ color: palette.text }}>Resume game {g.gameId.slice(-8)}</Text>
                      </Pressable>
                    ))}
                </>
              ) : null}
            </View>
          ) : (
            <View className="items-center">
              <Pressable className="mb-3 self-start" onPress={() => setSelectedGameId(null)}>
                <Text style={{ color: palette.action }}>← Back</Text>
              </Pressable>
              <Text className="mb-4 text-center text-sm" style={{ color: palette.muted }}>
                {statusLine}
              </Text>
              {replay ? (
                <View
                  className="rounded-[18px] border p-3"
                  style={{ borderColor: palette.border, backgroundColor: palette.card }}
                >
                  {[0, 1, 2].map((row) => (
                    <View key={row} className="mb-1 flex-row">
                      {[0, 1, 2].map((col) => {
                        const i = row * 3 + col;
                        const cell = replay.board[i];
                        return (
                          <Pressable
                            key={i}
                            disabled={!myTurn || !!replay.outcome}
                            onPress={() => void handleMove(i)}
                            className="mr-1 items-center justify-center rounded-xl border"
                            style={{
                              width: cellSize,
                              height: cellSize,
                              borderColor: palette.border,
                              backgroundColor: palette.surface,
                              opacity: !myTurn || replay.outcome ? 0.85 : 1
                            }}
                          >
                            <Text
                              className="text-5xl font-bold"
                              style={{ color: cell === 'X' ? palette.action : palette.text }}
                            >
                              {cell ?? ''}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: palette.muted }}>Loading board…</Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export function bubbleTextForMessage(item: ThreadMessage): string {
  const s = summarizeGameMessage(item.content, item.isOutgoing);
  if (s) {
    return s;
  }
  const g = parseGamePayload(item.content);
  if (g) {
    return item.isOutgoing ? '🎮 Game message sent' : '🎮 Game message';
  }
  return item.content;
}
