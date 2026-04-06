import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
    <View style={[StyleSheet.absoluteFillObject, styles.overlay]} className="items-center justify-center p-6">
      <View
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ backgroundColor: palette.card, borderColor: palette.border }}
      >
        <Text className="mb-3 text-lg" style={{ color: palette.text }}>
          {hasPin ? 'Unlock SecureChat' : 'Create a PIN'}
        </Text>
        <TextInput
          className="mb-2 rounded-xl border p-3 text-lg"
          style={{ borderColor: palette.border, color: palette.text }}
          keyboardType="number-pad"
          secureTextEntry
          placeholder="••••"
          value={value}
          onChangeText={(text) => {
            const sanitized = text.replace(/[^0-9]/g, '');
            setValue(sanitized);
          }}
        />
        {!!message && (
          <Text className="mt-1" style={{ color: palette.action }}>
            {message}
          </Text>
        )}
        <TouchableOpacity
          className="mt-3 items-center rounded-xl p-3"
          style={{ backgroundColor: palette.action }}
          onPress={handlePress}
        >
          <Text className="font-semibold text-white">{hasPin ? 'Unlock' : 'Save PIN'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 10
  }
});
