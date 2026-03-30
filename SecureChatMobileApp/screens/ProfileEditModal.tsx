import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { RootStackParamList } from '../navigation/types';
import { preferencesService } from '../services/preferencesService';
import { useTheme } from '../theme/ThemeContext';

export const ProfileEditModal: React.FC<
  NativeStackScreenProps<RootStackParamList, 'ProfileEditModal'>
> = ({ navigation }) => {
  const { palette } = useTheme();
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    preferencesService.getUsername().then((saved) => setUsername(saved ?? ''));
  }, []);

  const handleSave = async () => {
    Keyboard.dismiss();
    setSaving(true);
    try {
      const normalized = username.trim();
      await preferencesService.setUsername(normalized.length > 0 ? normalized : null);
      setFeedback('Profile updated');
      setTimeout(() => setFeedback(null), 1800);
      navigation.goBack();
    } catch (error) {
      console.error('Unable to save username', error);
      Alert.alert('Unable to save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}> 
      <Text style={[styles.label, { color: palette.muted }]}>Profile name</Text>
      <TextInput
        style={[styles.input, { borderColor: palette.border, color: palette.text }]}
        placeholder="Enter display name"
        placeholderTextColor={palette.placeholder}
        value={username}
        onChangeText={setUsername}
        editable={!saving}
      />
      <Text style={[styles.helper, { color: palette.muted }]}>Keep it simple and unique.</Text>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            {
              borderColor: palette.border,
              backgroundColor: pressed ? palette.surface : 'transparent'
            }
          ]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.actionText, { color: palette.text }]}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: palette.action }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.actionText, { color: '#fff' }]}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>
      {feedback ? <Text style={[styles.feedback, { color: palette.action }]}>{feedback}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center'
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 16
  },
  helper: {
    marginTop: 8,
    fontSize: 12
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 6
  },
  actionText: {
    fontWeight: '600'
  },
  feedback: {
    marginTop: 16,
    textAlign: 'center'
  }
});
