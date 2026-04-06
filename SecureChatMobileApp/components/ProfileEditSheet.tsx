import React, { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 justify-end">
          <Pressable
            className="absolute inset-0 bg-black/45"
            onPress={onClose}
            accessibilityLabel="Dismiss edit profile"
            accessibilityRole="button"
          />
          <View
            className="max-h-[88%] rounded-t-[20px] border-t px-5 pt-2"
            style={{
              backgroundColor: palette.surface,
              borderTopColor: palette.border,
              paddingBottom: Math.max(insets.bottom, 16)
            }}
          >
            <View className="mb-4 h-1 w-10 self-center rounded-sm" style={{ backgroundColor: palette.border }} />
            <Text className="mb-[18px] text-center text-lg font-bold" style={{ color: palette.text }}>
              Edit profile
            </Text>
            <Text className="mb-2 text-sm font-semibold" style={{ color: palette.muted }}>
              Profile name
            </Text>
            <TextInput
              className="rounded-[14px] border p-3.5 text-base"
              style={{ borderColor: palette.border, color: palette.text }}
              placeholder="Enter display name"
              placeholderTextColor={palette.placeholder}
              value={username}
              onChangeText={setUsername}
              editable={!saving}
              autoCorrect
              autoCapitalize="words"
            />
            <Text className="mt-2 text-xs" style={{ color: palette.muted }}>
              Keep it simple and unique.
            </Text>
            <View className="mt-5 flex-row gap-2.5">
              <Pressable
                className="flex-1 items-center rounded-[14px] border py-3.5"
                style={({ pressed }) => ({
                  borderColor: palette.border,
                  backgroundColor: pressed ? palette.background : 'transparent',
                  opacity: saving ? 0.6 : 1
                })}
                onPress={onClose}
                disabled={saving}
              >
                <Text className="text-base font-semibold" style={{ color: palette.text }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                className="flex-1 items-center rounded-[14px] py-3.5"
                style={{ backgroundColor: palette.action }}
                onPress={() => void handleSave()}
                disabled={saving}
              >
                <Text className="text-base font-semibold text-white">{saving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
