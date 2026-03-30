import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const ACCENT_COLORS = ['#1a9cff', '#10b981', '#f97316', '#a855f7', '#ec4899'];

export const AppearanceScreen: React.FC = () => {
  const { palette, preference, setMode, setAccent } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}> 
      <Text style={[styles.heading, { color: palette.text }]}>Appearance</Text>
      <View style={[styles.card, { backgroundColor: palette.surface, shadowColor: palette.shadow }]}> 
        <Text style={[styles.label, { color: palette.text }]}>Dark Mode</Text>
        <View style={styles.row}> 
          <Text style={[styles.subLabel, { color: palette.muted }]}>Keep secure vibes on</Text>
          <Switch
            value={preference.mode === 'dark'}
            onValueChange={(enabled) => setMode(enabled ? 'dark' : 'light')}
            thumbColor={preference.mode === 'dark' ? '#fff' : '#fff'}
            trackColor={{ false: '#37576b', true: '#a5b4fc' }}
          />
        </View>
      </View>
      <View style={[styles.card, { backgroundColor: palette.surface, shadowColor: palette.shadow }]}> 
        <Text style={[styles.label, { color: palette.text }]}>Accent color</Text>
        <View style={styles.swatches}>
          {ACCENT_COLORS.map((color) => (
            <Pressable
              key={color}
              style={[styles.swatch, { backgroundColor: color, borderColor: preference.accentColor === color ? '#fff' : 'transparent' }]}
              onPress={() => setAccent(color)}
            />
          ))}
        </View>
      </View>
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
    marginBottom: 24
  },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 8
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12
  },
  subLabel: {
    fontSize: 13,
    marginBottom: 0
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 2,
    marginRight: 12,
    marginBottom: 12
  }
});
