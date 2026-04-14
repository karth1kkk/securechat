import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
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
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refreshLocal = async () => {
    const [name, photo] = await Promise.all([
      preferencesService.getUsername(),
      preferencesService.getProfilePhotoUri()
    ]);
    setUsername(name ?? '');
    setAvatarUri(photo);
  };

  useEffect(() => {
    if (visible) {
      void refreshLocal();
    }
  }, [visible]);

  const persistPhoto = async (uri: string) => {
    await preferencesService.setProfilePhotoFromLocalUri(uri);
    setAvatarUri(await preferencesService.getProfilePhotoUri());
    onSaved?.();
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to choose a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85
    });
    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }
    try {
      await persistPhoto(result.assets[0].uri);
    } catch {
      Alert.alert('Unable to save photo', 'Please try another image.');
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take a profile picture.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85
    });
    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }
    try {
      await persistPhoto(result.assets[0].uri);
    } catch {
      Alert.alert('Unable to save photo', 'Please try again.');
    }
  };

  const removePhoto = () => {
    Alert.alert('Remove profile photo?', 'Your initials will show instead.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await preferencesService.clearProfilePhoto();
            setAvatarUri(null);
            onSaved?.();
          } catch {
            Alert.alert('Error', 'Could not remove the photo.');
          }
        }
      }
    ]);
  };

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
              Profile photo
            </Text>
            <View className="mb-4 flex-row items-center">
              <Pressable
                onPress={pickFromLibrary}
                className="h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full"
                style={{ backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border }}
                accessibilityRole="button"
                accessibilityLabel="Choose profile photo"
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <Feather name="user" size={32} color={palette.muted} />
                )}
              </Pressable>
              <View className="ml-4 flex-1">
                <Pressable
                  className="mb-2 flex-row items-center rounded-[12px] py-2"
                  onPress={() => void pickFromLibrary()}
                >
                  <Feather name="image" size={18} color={palette.action} />
                  <Text className="ml-2 text-sm font-semibold" style={{ color: palette.action }}>
                    Choose from library
                  </Text>
                </Pressable>
                <Pressable className="mb-2 flex-row items-center rounded-[12px] py-2" onPress={() => void takePhoto()}>
                  <Feather name="camera" size={18} color={palette.action} />
                  <Text className="ml-2 text-sm font-semibold" style={{ color: palette.action }}>
                    Take photo
                  </Text>
                </Pressable>
                {avatarUri ? (
                  <Pressable className="flex-row items-center rounded-[12px] py-2" onPress={removePhoto}>
                    <Feather name="trash-2" size={18} color="#f87171" />
                    <Text className="ml-2 text-sm font-semibold" style={{ color: '#f87171' }}>
                      Remove photo
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

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
