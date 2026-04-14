import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

type ThemeMode = 'light' | 'dark';

export interface ThemePreference {
  mode: ThemeMode;
  accentColor: string;
}

const USERNAME_KEY = 'securechat-username';
const THEME_KEY = 'securechat-theme';
const NOTIFICATIONS_KEY = 'securechat-notifications';
const PROFILE_AVATAR_WEB_KEY = 'securechat-profile-avatar-uri';
const PROFILE_AVATAR_FILENAME = 'profile-avatar.jpg';
export const DEFAULT_THEME: ThemePreference = { mode: 'dark', accentColor: '#1a9cff' };

export type NotificationPreferences = {
  /** Reserved for when push notifications are integrated. */
  pushAlerts: boolean;
  soundInApp: boolean;
  showMessagePreview: boolean;
};

export const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  pushAlerts: true,
  soundInApp: true,
  showMessagePreview: true
};

const normalize = (value: string | null) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const preferencesService = {
  async getUsername(): Promise<string | null> {
    try {
      const stored = await AsyncStorage.getItem(USERNAME_KEY);
      return normalize(stored);
    } catch (error) {
      console.warn('Unable to read username from storage', error);
      return null;
    }
  },

  async setUsername(username: string | null): Promise<void> {
    try {
      if (username === null) {
        await AsyncStorage.removeItem(USERNAME_KEY);
        return;
      }
      const normalized = normalize(username);
      if (normalized === null) {
        await AsyncStorage.removeItem(USERNAME_KEY);
        return;
      }
      await AsyncStorage.setItem(USERNAME_KEY, normalized);
    } catch (error) {
      console.warn('Unable to persist username', error);
    }
  },

  async getThemePreference(): Promise<ThemePreference> {
    try {
      const stored = await AsyncStorage.getItem(THEME_KEY);
      if (!stored) {
        return DEFAULT_THEME;
      }
      const parsed: ThemePreference = JSON.parse(stored);
      return { ...DEFAULT_THEME, ...parsed };
    } catch (error) {
      console.warn('Unable to load theme preference', error);
      return DEFAULT_THEME;
    }
  },

  async setThemePreference(preference: ThemePreference): Promise<void> {
    try {
      await AsyncStorage.setItem(THEME_KEY, JSON.stringify(preference));
    } catch (error) {
      console.warn('Unable to persist theme preference', error);
    }
  },

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      if (!stored) {
        return DEFAULT_NOTIFICATIONS;
      }
      const parsed: NotificationPreferences = JSON.parse(stored);
      return { ...DEFAULT_NOTIFICATIONS, ...parsed };
    } catch (error) {
      console.warn('Unable to load notification preferences', error);
      return DEFAULT_NOTIFICATIONS;
    }
  },

  async setNotificationPreferences(partial: Partial<NotificationPreferences>): Promise<void> {
    try {
      const current = await this.getNotificationPreferences();
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify({ ...current, ...partial }));
    } catch (error) {
      console.warn('Unable to persist notification preferences', error);
    }
  },

  async getProfilePhotoUri(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return await AsyncStorage.getItem(PROFILE_AVATAR_WEB_KEY);
      }
      const dir = FileSystem.documentDirectory;
      if (!dir) {
        return null;
      }
      const path = `${dir}${PROFILE_AVATAR_FILENAME}`;
      const info = await FileSystem.getInfoAsync(path);
      return info.exists ? path : null;
    } catch (error) {
      console.warn('Unable to read profile photo', error);
      return null;
    }
  },

  /** Persists a local image (e.g. from ImagePicker) as the profile avatar. */
  async setProfilePhotoFromLocalUri(localUri: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(PROFILE_AVATAR_WEB_KEY, localUri);
        return;
      }
      const dir = FileSystem.documentDirectory;
      if (!dir) {
        throw new Error('Local file storage is unavailable.');
      }
      const dest = `${dir}${PROFILE_AVATAR_FILENAME}`;
      await FileSystem.copyAsync({ from: localUri, to: dest });
    } catch (error) {
      console.warn('Unable to save profile photo', error);
      throw error;
    }
  },

  async clearProfilePhoto(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PROFILE_AVATAR_WEB_KEY);
    } catch (error) {
      console.warn('Unable to clear profile photo key', error);
    }
    try {
      if (Platform.OS !== 'web' && FileSystem.documentDirectory) {
        await FileSystem.deleteAsync(`${FileSystem.documentDirectory}${PROFILE_AVATAR_FILENAME}`, {
          idempotent: true
        });
      }
    } catch (error) {
      console.warn('Unable to delete profile photo file', error);
    }
  }
};

export type { ThemeMode };
