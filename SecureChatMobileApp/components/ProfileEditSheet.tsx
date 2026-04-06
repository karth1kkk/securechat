import React, { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { preferencesService } from '../services/preferencesService';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful save so the parent can refresh display name. */
  onSaved?: () => void;
};

export function ProfileEditSheet({ visible, onClose, onSaved }: Props) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      void preferencesService.getUsername().then((saved) => setUsername(saved ?? ''));
    }
  }, [visible]);

  const handleSave = async () => {
    Keyboard.dismiss();
    setSaving(true);
    try {
      const normalized = username.trim();
      await preferencesService.setUsername(normalized.length > 0 ? normalized : null);
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('Unable to save username', error);
      Alert.alert('Unable to save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.root}>
          <Pressable
            style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
            onPress={onClose}
            accessibilityLabel="Dismiss edit profile"
            accessibilityRole="button"
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: palette.surface,
                borderTopColor: palette.border,
                paddingBottom: Math.max(insets.bottom, 16)
              }
            ]}
          >
            <View style={[styles.handle, { backgroundColor: palette.border }]} />
            <Text style={[styles.title, { color: palette.text }]}>Edit profile</Text>
            <Text style={[styles.label, { color: palette.muted }]}>Profile name</Text>
            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.text }]}
              placeholder="Enter display name"
              placeholderTextColor={palette.placeholder}
              value={username}
              onChangeText={setUsername}
              editable={!saving}
              autoCorrect
              autoCapitalize="words"
            />
            <Text style={[styles.helper, { color: palette.muted }]}>Keep it simple and unique.</Text>
            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  {
                    borderColor: palette.border,
                    backgroundColor: pressed ? palette.background : 'transparent'
                  }
                ]}
                onPress={onClose}
                disabled={saving}
              >
                <Text style={[styles.actionText, { color: palette.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.primaryButton, { backgroundColor: palette.action }]}
                onPress={() => void handleSave()}
                disabled={saving}
              >
                <Text style={[styles.actionText, { color: '#fff' }]}>{saving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: '88%'
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 16
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 18
  },
  label: {
    fontSize: 14,
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
    gap: 10,
    marginTop: 22
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center'
  },
  primaryButton: {
    borderWidth: 0
  },
  actionText: {
    fontWeight: '600',
    fontSize: 16
  }
});
