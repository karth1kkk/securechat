import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';

export const SettingsScreen: React.FC<NativeStackScreenProps<RootStackParamList, 'Settings'>> = ({ navigation }) => {
  const { palette } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}> 
      <Text style={[styles.heading, { color: palette.text }]}>App Lock</Text>
      <Text style={[styles.body, { color: palette.muted }]}>PIN + biometric ready (optional)</Text>
      <View style={[styles.divider, { borderColor: palette.border }]} />
      <Text style={[styles.heading, { color: palette.text }]}>Preferences</Text>
      <Pressable
        style={[styles.option, { borderColor: palette.border }]}
        onPress={() => navigation.navigate('Profile')}
      >
        <Text style={[styles.optionText, { color: palette.text }]}>Profile & Theme</Text>
        <Text style={[styles.optionMeta, { color: palette.muted }]}>Update username and accent</Text>
      </Pressable>
      <Pressable
        style={[styles.option, { borderColor: palette.border }]}
        onPress={() => navigation.navigate('SecurityCenter')}
      >
        <Text style={[styles.optionText, { color: palette.text }]}>Security Center</Text>
        <Text style={[styles.optionMeta, { color: palette.muted }]}>View session identity and rotate keys</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 4
  },
  body: {
    fontSize: 14,
    marginBottom: 16
  },
  divider: {
    borderBottomWidth: 1,
    marginVertical: 16
  },
  option: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600'
  },
  optionMeta: {
    fontSize: 12,
    marginTop: 4
  }
});
