import React, { useCallback, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, Text, View } from 'react-native';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'TicTacToe'>;

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

const emptyBoard = (): Cell[] => Array<Cell>(9).fill(null);

const checkOutcome = (board: Cell[]): 'X' | 'O' | 'draw' | null => {
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
};

const minimax = (board: Cell[], isMaximizing: boolean): number => {
  const outcome = checkOutcome(board);
  if (outcome === 'O') {
    return 10;
  }
  if (outcome === 'X') {
    return -10;
  }
  if (outcome === 'draw') {
    return 0;
  }

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i += 1) {
      if (board[i] === null) {
        const next = board.slice();
        next[i] = 'O';
        const score = minimax(next, false);
        best = Math.max(best, score);
      }
    }
    return best;
  }

  let best = Infinity;
  for (let i = 0; i < 9; i += 1) {
    if (board[i] === null) {
      const next = board.slice();
      next[i] = 'X';
      const score = minimax(next, true);
      best = Math.min(best, score);
    }
  }
  return best;
};

const bestMove = (board: Cell[]): number => {
  let best = -Infinity;
  let move = -1;
  for (let i = 0; i < 9; i += 1) {
    if (board[i] === null) {
      const next = board.slice();
      next[i] = 'O';
      const score = minimax(next, false);
      if (score > best) {
        best = score;
        move = i;
      }
    }
  }
  return move;
};

export const TicTacToeScreen: React.FC<Props> = () => {
  const { palette } = useTheme();
  const [board, setBoard] = useState<Cell[]>(emptyBoard);
  const [gameOver, setGameOver] = useState(false);

  const status = useMemo(() => {
    const outcome = checkOutcome(board);
    if (outcome === 'X') {
      return 'You win!';
    }
    if (outcome === 'O') {
      return 'Computer wins';
    }
    if (outcome === 'draw') {
      return 'Draw';
    }
    return 'Your turn (X)';
  }, [board]);

  const playComputer = useCallback((nextBoard: Cell[]) => {
    const outcome = checkOutcome(nextBoard);
    if (outcome) {
      setBoard(nextBoard);
      setGameOver(true);
      return;
    }
    const idx = bestMove(nextBoard);
    if (idx < 0) {
      setBoard(nextBoard);
      return;
    }
    const after = nextBoard.slice();
    after[idx] = 'O';
    setBoard(after);
    if (checkOutcome(after)) {
      setGameOver(true);
    }
  }, []);

  const handleCell = (index: number) => {
    if (gameOver || board[index] !== null) {
      return;
    }
    const next = board.slice();
    next[index] = 'X';
    const immediate = checkOutcome(next);
    if (immediate === 'X' || immediate === 'draw') {
      setBoard(next);
      setGameOver(true);
      return;
    }
    playComputer(next);
  };

  const reset = () => {
    setBoard(emptyBoard());
    setGameOver(false);
  };

  const cellSize = 92;

  return (
    <View className="flex-1 items-center px-4 py-6" style={{ backgroundColor: palette.background }}>
      <Text className="mb-6 text-center text-base" style={{ color: palette.muted }}>
        {status}
      </Text>

      <View
        className="rounded-[18px] border p-3"
        style={{ borderColor: palette.border, backgroundColor: palette.card }}
      >
        {[0, 1, 2].map((row) => (
          <View key={row} className="mb-1 flex-row">
            {[0, 1, 2].map((col) => {
              const i = row * 3 + col;
              const cell = board[i];
              return (
                <Pressable
                  key={i}
                  onPress={() => handleCell(i)}
                  className="mr-1 items-center justify-center rounded-xl border"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    borderColor: palette.border,
                    backgroundColor: palette.surface
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Cell ${i + 1}${cell ? ` ${cell}` : ' empty'}`}
                >
                  <Text className="text-5xl font-bold" style={{ color: cell === 'X' ? palette.action : palette.text }}>
                    {cell ?? ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <Pressable
        className="mt-8 rounded-xl px-8 py-3"
        style={{ backgroundColor: palette.action }}
        onPress={reset}
      >
        <Text className="font-semibold text-white">New game</Text>
      </Pressable>
    </View>
  );
};
