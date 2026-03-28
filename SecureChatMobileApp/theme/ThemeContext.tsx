import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Theme as NavigationTheme } from '@react-navigation/native';
import { preferencesService, ThemePreference, DEFAULT_THEME } from '../services/preferencesService';

export interface ThemePalette {
  background: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  bubbleIncoming: string;
  bubbleOutgoing: string;
  placeholder: string;
  header: string;
  statusBarStyle: 'light' | 'dark';
  action: string;
}

export interface ThemeContextValue {
  preference: ThemePreference;
  palette: ThemePalette;
  navigationTheme: NavigationTheme;
  setMode: (mode: ThemePreference['mode']) => void;
  setAccent: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const buildPalette = (preference: ThemePreference): ThemePalette => {
  const isDark = preference.mode === 'dark';
  return {
    background: isDark ? '#050507' : '#f5f5f7',
    card: isDark ? '#0f0f14' : '#ffffff',
    text: isDark ? '#f5f5f5' : '#111111',
    muted: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(17,17,17,0.6)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    bubbleIncoming: isDark ? 'rgba(255,255,255,0.08)' : '#f1f1f1',
    bubbleOutgoing: preference.accentColor,
    placeholder: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
    header: isDark ? '#0b0b0d' : '#f0f0f4',
    statusBarStyle: isDark ? 'light' : 'dark',
    action: preference.accentColor
  };
};

const buildNavigationTheme = (palette: ThemePalette, preference: ThemePreference): NavigationTheme => ({
  dark: preference.mode === 'dark',
  colors: {
    primary: preference.accentColor,
    background: palette.background,
    card: palette.card,
    text: palette.text,
    border: palette.border,
    notification: preference.accentColor
  }
});

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [preference, setPreference] = useState<ThemePreference>(DEFAULT_THEME);

  useEffect(() => {
    preferencesService.getThemePreference().then(setPreference);
  }, []);

  const updatePreference = useCallback((patch: Partial<ThemePreference>) => {
    setPreference((current) => {
      const next = { ...current, ...patch };
      preferencesService.setThemePreference(next);
      return next;
    });
  }, []);

  const setMode = useCallback((mode: ThemePreference['mode']) => updatePreference({ mode }), [updatePreference]);
  const setAccent = useCallback((accentColor: string) => updatePreference({ accentColor }), [updatePreference]);

  const palette = useMemo(() => buildPalette(preference), [preference]);
  const navigationTheme = useMemo(() => buildNavigationTheme(palette, preference), [palette, preference]);

  const value = useMemo(
    () => ({ preference, palette, navigationTheme, setMode, setAccent }),
    [preference, palette, navigationTheme, setMode, setAccent]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
