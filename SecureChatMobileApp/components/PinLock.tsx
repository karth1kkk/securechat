import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  onUnlock: (pin: string) => void;
  onCreate: (pin: string) => void;
  hasPin: boolean;
  visible: boolean;
}

export const PinLock: React.FC<Props> = ({ onUnlock, onCreate, hasPin, visible }) => {
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');
  const { palette } = useTheme();

  useEffect(() => {
    setValue('');
    setMessage('');
  }, [visible]);

  if (!visible) {
    return null;
  }

  const handlePress = () => {
    if (value.length < 4) {
      setMessage('Enter at least 4 digits');
      return;
    }

    if (hasPin) {
      onUnlock(value);
    } else {
      onCreate(value);
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>{hasPin ? 'Unlock SecureChat' : 'Create a PIN'}</Text>
        <TextInput
          style={[styles.input, { borderColor: palette.border, color: palette.text }]}
          keyboardType="number-pad"
          secureTextEntry
          placeholder="••••"
          value={value}
          onChangeText={(text) => {
            const sanitized = text.replace(/[^0-9]/g, '');
            setValue(sanitized);
          }}
        />
        {!!message && <Text style={[styles.message, { color: palette.action }]}>{message}</Text>}
        <TouchableOpacity style={[styles.button, { backgroundColor: palette.action }]} onPress={handlePress}>
          <Text style={styles.buttonText}>{hasPin ? 'Unlock' : 'Save PIN'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 10
  },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)'
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    marginBottom: 12
  },
  input: {
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    color: '#ffffff',
    fontSize: 18,
    marginBottom: 8
  },
  button: {
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center'
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600'
  },
  message: {
    color: '#ffcccb',
    marginTop: 4
  }
});
