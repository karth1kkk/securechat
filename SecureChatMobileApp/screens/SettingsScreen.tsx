import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

export const SettingsScreen: React.FC<NativeStackScreenProps<RootStackParamList, 'Settings'>> = ({ navigation }) => {
  const [darkMode] = useState(true);
  const [autoDelete, setAutoDelete] = useState(true);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>App Lock</Text>
      <Text style={styles.value}>PIN + biometric ready (optional)</Text>
      <Text style={[styles.label, { marginTop: 24 }]}>Privacy defaults</Text>
      <View style={styles.row}>
        <Text style={styles.value}>Dark mode</Text>
        <Switch value={darkMode} disabled />
      </View>
      <View style={styles.row}>
        <Text style={styles.value}>Auto-delete after 30 days</Text>
        <Switch value={autoDelete} onValueChange={setAutoDelete} />
      </View>
      <Pressable style={styles.button} onPress={() => navigation.navigate('SecurityCenter')}>
        <Text style={styles.buttonText}>Security Center</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0d',
    padding: 16
  },
  label: {
    color: '#ffffff',
    fontSize: 22,
    marginBottom: 8
  },
  value: {
    color: '#c0c0c0'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16
  },
  button: {
    marginTop: 32,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#1a9cff',
    alignItems: 'center'
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600'
  }
});
