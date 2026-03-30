import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Theme as NavigationTheme } from '@react-navigation/native';
import { preferencesService, ThemePreference, DEFAULT_THEME } from '../services/preferencesService';

export interface ThemePalette {
  background: string;
  surface: string;
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
  glow: string;
  shadow: string;
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
  const accentGlow = `${preference.accentColor}33`;
  return {
    background: isDark ? '#0f172a' : '#f8fafc',
    surface: isDark ? '#111827' : '#ffffff',
    card: isDark ? '#1e293b' : '#fdfdfd',
    text: isDark ? '#f8fafc' : '#0f172a',
    muted: isDark ? 'rgba(248,250,252,0.65)' : 'rgba(15,23,42,0.55)',
    border: isDark ? 'rgba(248,250,252,0.08)' : 'rgba(15,23,42,0.08)',
    bubbleIncoming: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
    bubbleOutgoing: preference.accentColor,
    placeholder: isDark ? 'rgba(248,250,252,0.4)' : 'rgba(15,23,42,0.4)',
    header: isDark ? '#0b1220' : '#f8fafc',
    statusBarStyle: isDark ? 'light' : 'dark',
    action: preference.accentColor,
    glow: accentGlow,
    shadow: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(15,23,42,0.12)'
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
