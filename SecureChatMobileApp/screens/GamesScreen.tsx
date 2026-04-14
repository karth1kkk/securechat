import React, { useCallback, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { gameStatsService, LeaderboardSnapshot } from '../services/gameStatsService';

type Props = NativeStackScreenProps<RootStackParamList, 'Games'>;

export const GamesScreen: React.FC<Props> = ({ navigation }) => {
  const { palette } = useTheme();
  const [leaderboard, setLeaderboard] = useState<LeaderboardSnapshot | null>(null);

  const refreshLeaderboard = useCallback(() => {
    void gameStatsService.getSnapshot().then(setLeaderboard);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshLeaderboard();
    }, [refreshLeaderboard])
  );

  return (
    <ScrollView className="flex-1 px-4 py-4" style={{ backgroundColor: palette.background }}>
      <Text className="mb-1 text-lg font-semibold" style={{ color: palette.text }}>
        Games
      </Text>
      <Text className="mb-5 text-sm leading-6" style={{ color: palette.muted }}>
        Multiplayer: open a chat and tap the game controller in the header. Choose Tic-tac-toe, Dots and Boxes,
        or Truth or dare — moves are encrypted like any message. Finished games update the leaderboard below.
        Tic-tac-toe practice at the bottom is offline only.
      </Text>

      {leaderboard ? (
        <View
          className="mb-5 rounded-[18px] border p-4"
          style={{ borderColor: palette.border, backgroundColor: palette.surface }}
        >
          <Text className="mb-3 text-base font-semibold" style={{ color: palette.text }}>
            Game leaderboard
          </Text>
          <Text className="mb-2 text-xs leading-5" style={{ color: palette.muted }}>
            Wins, losses, and draws from finished chat games on this device. Truth or dare counts completed sessions.
          </Text>
          {(
            [
              ['Tic-tac-toe', leaderboard.ttt],
              ['Dots and Boxes', leaderboard.dab]
            ] as const
          ).map(([label, s]) => (
            <View key={label} className="mb-2 flex-row justify-between">
              <Text className="text-sm" style={{ color: palette.text }}>
                {label}
              </Text>
              <Text className="text-sm" style={{ color: palette.muted }}>
                W {s.wins} · L {s.losses} · D {s.draws}
              </Text>
            </View>
          ))}
          <View className="mt-1 flex-row justify-between">
            <Text className="text-sm" style={{ color: palette.text }}>
              Truth or dare
            </Text>
            <Text className="text-sm" style={{ color: palette.muted }}>
              Sessions ended: {leaderboard.todSessions}
            </Text>
          </View>
        </View>
      ) : null}

      <Pressable
        className="mb-3 flex-row items-center rounded-[14px] border p-4"
        style={{ borderColor: palette.border, backgroundColor: palette.card }}
        onPress={() => navigation.navigate('TicTacToe')}
      >
        <View
          className="mr-3 h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: palette.surface }}
        >
          <Ionicons name="grid" size={24} color={palette.action} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold" style={{ color: palette.text }}>
            Tic-tac-toe (practice)
          </Text>
          <Text className="mt-1 text-sm" style={{ color: palette.muted }}>
            Play as X against the computer (O), no network.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={palette.muted} />
      </Pressable>
    </ScrollView>
  );
};
