import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark';

export interface ThemePreference {
  mode: ThemeMode;
  accentColor: string;
}

const USERNAME_KEY = 'securechat-username';
const THEME_KEY = 'securechat-theme';
export const DEFAULT_THEME: ThemePreference = { mode: 'dark', accentColor: '#1a9cff' };

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
  }
};

export type { ThemeMode };
