import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { pinService } from '../services/pinService';
import { useTheme } from '../theme/ThemeContext';

const PIN_LENGTH = 6;

function sanitizeDigits(value: string): string {
  return value.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH);
}

export const ChangePinScreen: React.FC = () => {
  const { palette } = useTheme();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChangePin = async () => {
    setError(null);
    setFeedback(null);

    if (newPin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH) {
      setError('New PIN must be exactly 6 digits.');
      return;
    }

    if (newPin !== confirmPin) {
      setError('New PIN and confirmation do not match.');
      return;
    }

    if (currentPin === newPin) {
      setError('New PIN must be different from current PIN.');
      return;
    }

    setBusy(true);
    try {
      const verified = await pinService.verifyPin(currentPin);
      if (!verified) {
        setError('Current PIN is incorrect.');
        return;
      }

      await pinService.setPin(newPin);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setFeedback('PIN updated successfully.');
    } catch (changeError) {
      console.error('Unable to change PIN', changeError);
      setError('Unable to change PIN right now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 16, paddingBottom: 32, backgroundColor: palette.background }}
      keyboardShouldPersistTaps="handled"
    >
      <Text className="mb-2 text-base font-semibold" style={{ color: palette.text }}>
        Change PIN
      </Text>
      <Text className="mb-4 text-sm leading-5" style={{ color: palette.muted }}>
        Enter your current PIN and set a new 6-digit PIN for unlocking this device.
      </Text>

      <View className="mb-3">
        <Text className="mb-1 text-sm" style={{ color: palette.muted }}>
          Current PIN
        </Text>
        <TextInput
          className="rounded-xl border p-3 text-lg"
          style={{ borderColor: palette.border, color: palette.text }}
          value={currentPin}
          keyboardType="number-pad"
          secureTextEntry
          placeholder="••••••"
          onChangeText={(value) => setCurrentPin(sanitizeDigits(value))}
        />
      </View>

      <View className="mb-3">
        <Text className="mb-1 text-sm" style={{ color: palette.muted }}>
          New PIN
        </Text>
        <TextInput
          className="rounded-xl border p-3 text-lg"
          style={{ borderColor: palette.border, color: palette.text }}
          value={newPin}
          keyboardType="number-pad"
          secureTextEntry
          placeholder="••••••"
          onChangeText={(value) => setNewPin(sanitizeDigits(value))}
        />
      </View>

      <View className="mb-3">
        <Text className="mb-1 text-sm" style={{ color: palette.muted }}>
          Confirm new PIN
        </Text>
        <TextInput
          className="rounded-xl border p-3 text-lg"
          style={{ borderColor: palette.border, color: palette.text }}
          value={confirmPin}
          keyboardType="number-pad"
          secureTextEntry
          placeholder="••••••"
          onChangeText={(value) => setConfirmPin(sanitizeDigits(value))}
        />
      </View>

      {error ? (
        <Text className="mb-3 text-sm" style={{ color: '#ef4444' }}>
          {error}
        </Text>
      ) : null}
      {feedback ? (
        <Text className="mb-3 text-sm" style={{ color: palette.action }}>
          {feedback}
        </Text>
      ) : null}

      <Pressable
        className="items-center rounded-xl py-3"
        style={{ backgroundColor: palette.action, opacity: busy ? 0.6 : 1 }}
        onPress={() => void handleChangePin()}
        disabled={busy}
      >
        <Text className="font-semibold text-white">{busy ? 'Updating…' : 'Update PIN'}</Text>
      </Pressable>
    </ScrollView>
  );
};
