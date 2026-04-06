import React from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const ACCENT_COLORS = ['#1a9cff', '#10b981', '#f97316', '#a855f7', '#ec4899'];

export const AppearanceScreen: React.FC = () => {
  const { palette, preference, setMode, setAccent } = useTheme();

  return (
    <View className="flex-1 p-4" style={{ backgroundColor: palette.background }}>
      <Text className="mb-6 text-2xl font-semibold" style={{ color: palette.text }}>
        Appearance
      </Text>
      <View
        className="mb-4 rounded-[20px] p-5"
        style={{
          backgroundColor: palette.surface,
          shadowColor: palette.shadow,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.4,
          shadowRadius: 25,
          elevation: 8
        }}
      >
        <Text className="mb-3 text-base font-semibold" style={{ color: palette.text }}>
          Dark Mode
        </Text>
        <View className="flex-row items-center justify-between">
          <Text className="text-[13px]" style={{ color: palette.muted }}>
            Keep secure vibes on
          </Text>
          <Switch
            value={preference.mode === 'dark'}
            onValueChange={(enabled) => setMode(enabled ? 'dark' : 'light')}
            thumbColor="#fff"
            trackColor={{ false: '#37576b', true: '#a5b4fc' }}
          />
        </View>
      </View>
      <View
        className="rounded-[20px] p-5"
        style={{
          backgroundColor: palette.surface,
          shadowColor: palette.shadow,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.4,
          shadowRadius: 25,
          elevation: 8
        }}
      >
        <Text className="mb-3 text-base font-semibold" style={{ color: palette.text }}>
          Accent color
        </Text>
        <View className="flex-row flex-wrap">
          {ACCENT_COLORS.map((color) => (
            <Pressable
              key={color}
              className="mb-3 mr-3 h-12 w-12 rounded-2xl border-2"
              style={{
                backgroundColor: color,
                borderColor: preference.accentColor === color ? '#fff' : 'transparent'
              }}
              onPress={() => setAccent(color)}
            />
          ))}
        </View>
      </View>
    </View>
  );
};
