import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApolloClient } from '@apollo/client';
import * as Clipboard from 'expo-clipboard';
import { UPDATE_USERNAME } from '../graphql/mutations';
import { sessionService } from '../services/sessionService';
import { preferencesService } from '../services/preferencesService';
import { useTheme } from '../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
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
    <View style={[styles.container, { backgroundColor: palette.background }]}> 
      {/* <Text style={[styles.heading, { color: palette.text }]}>Profile</Text> */}
      <TextInput
        placeholder="Display name (optional)"
        placeholderTextColor={palette.placeholder}
        style={[styles.input, { borderColor: palette.border, color: palette.text }]}
        value={username}
        onChangeText={setUsername}
        editable={!saving}
      />
      <Pressable style={[styles.button, { backgroundColor: palette.action }]} onPress={handleSaveUsername} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save username'}</Text>
      </Pressable>
      <View style={styles.section}>
        <Text style={[styles.label, { color: palette.muted }]}>Session ID</Text>
        <View style={[styles.row, { borderColor: palette.border }]}> 
          <Text style={[styles.value, { color: palette.text }]} numberOfLines={2} ellipsizeMode="middle">
            {sessionId ?? 'Loading…'}
          </Text>
          <Pressable style={styles.copyButton} onPress={handleCopy} accessibilityLabel="Copy session id">
            <Ionicons name="copy-outline" size={18} color={palette.action} />
          </Pressable>
        </View>
      </View>
      <View style={styles.section}>
        <Text style={[styles.label, { color: palette.muted }]}>Theme</Text>
        <View style={styles.row}> 
          <Pressable
            style={[styles.modeButton, preference.mode === 'light' && { borderColor: palette.action }]}
            onPress={() => setMode('light')}
          >
            <Text style={[styles.optionText, { color: preference.mode === 'light' ? palette.action : palette.text }]}>Light</Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, preference.mode === 'dark' && { borderColor: palette.action }]}
            onPress={() => setMode('dark')}
          >
            <Text style={[styles.optionText, { color: preference.mode === 'dark' ? palette.action : palette.text }]}>Dark</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.section}>
        <Text style={[styles.label, { color: palette.muted }]}>Accent color</Text>
        <View style={styles.accentRow}>
          {accentOptions.map((color) => (
            <Pressable
              key={color}
              style={[styles.accentCircle, { backgroundColor: color }, preference.accentColor === color && styles.accentActive]}
              onPress={() => setAccent(color)}
            />
          ))}
        </View>
      </View>
      {feedback ? <Text style={[styles.feedback, { color: feedback.includes('copied') ? palette.action : '#ff8f8f' }]}>{feedback}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12
  },
  button: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600'
  },
  section: {
    marginTop: 24
  },
  label: {
    fontSize: 14,
    marginBottom: 8
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap'
  },
  value: {
    flexBasis: '90%',
    fontSize: 14,
    marginBottom: 4
  },
  copy: {
    fontWeight: '600'
  },
  copyButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  modeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginRight: 8
  },
  optionText: {
    fontWeight: '600'
  },
  accentRow: {
    flexDirection: 'row',
    marginTop: 8
  },
  accentCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12
  },
  accentActive: {
    borderWidth: 2,
    borderColor: '#ffffff'
  },
  feedback: {
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center'
  }
});
