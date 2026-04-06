import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useApolloClient } from '@apollo/client';
import * as Clipboard from 'expo-clipboard';
import { UPDATE_USERNAME } from '../graphql/mutations';
import { sessionService } from '../services/sessionService';
import { preferencesService } from '../services/preferencesService';
import { useTheme } from '../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { cn } from '../lib/cn';

const accentOptions = ['#1a9cff', '#e91e63', '#00c853', '#ff9800'];

export const ProfileScreen: React.FC = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const client = useApolloClient();
  const { preference, setMode, setAccent, palette } = useTheme();

  useEffect(() => {
    sessionService.ensureSession().then((session) => {
      setSessionId(session.sessionId);
    });
    preferencesService.getUsername().then((saved) => setUsername(saved ?? ''));
  }, []);

  const handleCopy = () => {
    if (!sessionId) {
      return;
    }
    Clipboard.setStringAsync(sessionId);
    setFeedback('Session ID copied');
    setTimeout(() => setFeedback(null), 1800);
  };

  const handleSaveUsername = async () => {
    setSaving(true);
    try {
      const normalized = username.trim();
      await client.mutate({
        mutation: UPDATE_USERNAME,
        variables: { input: { username: normalized.length > 0 ? normalized : null } }
      });
      await preferencesService.setUsername(normalized.length > 0 ? normalized : null);
      setFeedback('Username saved');
    } catch (error) {
      console.error('Username save failed', error);
      setFeedback('Unable to save username');
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 1800);
    }
  };

  return (
    <View className="flex-1 p-4" style={{ backgroundColor: palette.background }}>
      <TextInput
        placeholder="Display name (optional)"
        placeholderTextColor={palette.placeholder}
        className="mb-3 rounded-xl border p-3"
        style={{ borderColor: palette.border, color: palette.text }}
        value={username}
        onChangeText={setUsername}
        editable={!saving}
      />
      <Pressable
        className="items-center rounded-xl p-3.5"
        style={{ backgroundColor: palette.action }}
        onPress={handleSaveUsername}
        disabled={saving}
      >
        <Text className="font-semibold text-white">{saving ? 'Saving…' : 'Save username'}</Text>
      </Pressable>
      <View className="mt-6">
        <Text className="mb-2 text-sm" style={{ color: palette.muted }}>
          Session ID
        </Text>
        <View className="flex-row flex-wrap items-center justify-between rounded-xl border p-2" style={{ borderColor: palette.border }}>
          <Text className="mb-1 flex-[0.9] text-sm" style={{ color: palette.text }} numberOfLines={2} ellipsizeMode="middle">
            {sessionId ?? 'Loading…'}
          </Text>
          <Pressable className="rounded-[10px] border border-transparent px-3 py-1.5" onPress={handleCopy} accessibilityLabel="Copy session id">
            <Ionicons name="copy-outline" size={18} color={palette.action} />
          </Pressable>
        </View>
      </View>
      <View className="mt-6">
        <Text className="mb-2 text-sm" style={{ color: palette.muted }}>
          Theme
        </Text>
        <View className="flex-row flex-wrap items-center justify-between">
          <Pressable
            className={cn('mr-2 flex-1 items-center rounded-xl border px-3 py-3', preference.mode === 'light' && 'border-2')}
            style={{ borderColor: preference.mode === 'light' ? palette.action : 'transparent' }}
            onPress={() => setMode('light')}
          >
            <Text className="font-semibold" style={{ color: preference.mode === 'light' ? palette.action : palette.text }}>
              Light
            </Text>
          </Pressable>
          <Pressable
            className={cn('flex-1 items-center rounded-xl border px-3 py-3', preference.mode === 'dark' && 'border-2')}
            style={{ borderColor: preference.mode === 'dark' ? palette.action : 'transparent' }}
            onPress={() => setMode('dark')}
          >
            <Text className="font-semibold" style={{ color: preference.mode === 'dark' ? palette.action : palette.text }}>
              Dark
            </Text>
          </Pressable>
        </View>
      </View>
      <View className="mt-6">
        <Text className="mb-2 text-sm" style={{ color: palette.muted }}>
          Accent color
        </Text>
        <View className="mt-2 flex-row">
          {accentOptions.map((color) => (
            <Pressable
              key={color}
              className="mr-3 h-10 w-10 rounded-full"
              style={{
                backgroundColor: color,
                borderWidth: preference.accentColor === color ? 2 : 0,
                borderColor: '#fff'
              }}
              onPress={() => setAccent(color)}
            />
          ))}
        </View>
      </View>
      {feedback ? (
        <Text className="mt-4 text-center text-sm" style={{ color: feedback.includes('copied') ? palette.action : '#ff8f8f' }}>
          {feedback}
        </Text>
      ) : null}
    </View>
  );
};
