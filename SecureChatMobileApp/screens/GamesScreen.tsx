import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Games'>;

export const GamesScreen: React.FC<Props> = ({ navigation }) => {
  const { palette } = useTheme();

  return (
    <ScrollView className="flex-1 px-4 py-4" style={{ backgroundColor: palette.background }}>
      <Text className="mb-1 text-lg font-semibold" style={{ color: palette.text }}>
        Games
      </Text>
      <Text className="mb-5 text-sm leading-6" style={{ color: palette.muted }}>
        Play with a contact in any open chat: tap the game controller in the conversation header, then start or join
        Tic-tac-toe. Moves travel as encrypted messages. Practice mode below is offline on this device only.
      </Text>

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
