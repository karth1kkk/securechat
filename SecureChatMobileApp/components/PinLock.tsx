import React, { useEffect, useState } from 'react';
import { Platform, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../theme/ThemeContext';
import { pinRecoveryService } from '../services/pinRecoveryService';
import { pinService } from '../services/pinService';

interface Props {
  onUnlock: (pin: string) => void;
  onCreate: (pin: string) => Promise<string | void>;
  hasPin: boolean;
  visible: boolean;
}

export const PinLock: React.FC<Props> = ({ onUnlock, onCreate, hasPin, visible }) => {
  const [value, setValue] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showRecoveryStep, setShowRecoveryStep] = useState(false);
  const [createdRecoveryCode, setCreatedRecoveryCode] = useState('');
  const [createdPin, setCreatedPin] = useState('');
  const { palette } = useTheme();

  useEffect(() => {
    setValue('');
    setResetMode(false);
    setRecoveryCode('');
    setNewPin('');
    setConfirmNewPin('');
    setShowRecoveryStep(false);
    setCreatedRecoveryCode('');
    setCreatedPin('');
    setBusy(false);
    setMessage('');
  }, [visible]);

  if (!visible) {
    return null;
  }

  const handleSaveOrDownload = (code: string) => {
    if (Platform.OS === 'web') {
      try {
        const content = `SecureChat PIN Recovery Code\n\n${code}\n`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'securechat-pin-recovery-code.txt';
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Recovery code download failed', error);
      }
      return;
    }

    void Share.share({
      message: `SecureChat PIN Recovery Code: ${code}`
    });
  };

  const handlePress = async () => {
    if (hasPin && value.length < 4) {
      setMessage('Enter your PIN');
      return;
    }

    if (!hasPin && value.length !== 6) {
      setMessage('Enter exactly 6 digits');
      return;
    }

    if (hasPin) {
      onUnlock(value);
    } else {
      setBusy(true);
      try {
        const createdRecoveryCode = await onCreate(value);
        if (createdRecoveryCode) {
          setCreatedRecoveryCode(createdRecoveryCode);
          setCreatedPin(value);
          setShowRecoveryStep(true);
        }
      } finally {
        setBusy(false);
      }
    }
  };

  const handleForgotPinReset = async () => {
    setMessage('');
    const normalizedCode = recoveryCode.replace(/[^0-9]/g, '');

    if (normalizedCode.length !== 16) {
      setMessage('Recovery code must be exactly 16 digits.');
      return;
    }

    if (newPin.length !== 6) {
      setMessage('New PIN must be exactly 6 digits.');
      return;
    }

    if (newPin !== confirmNewPin) {
      setMessage('New PIN and confirmation do not match.');
      return;
    }

    setBusy(true);
    try {
      const verified = await pinRecoveryService.verifyRecoveryCode(normalizedCode);
      if (!verified) {
        setMessage('Recovery code is incorrect.');
        return;
      }
      await pinService.setPin(newPin);
      onUnlock(newPin);
      setMessage('PIN reset successful.');
      setResetMode(false);
      setRecoveryCode('');
      setNewPin('');
      setConfirmNewPin('');
      setValue('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.overlay]} className="items-center justify-center p-6">
      <View
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ backgroundColor: palette.card, borderColor: palette.border }}
      >
        <Text className="mb-3 text-lg" style={{ color: palette.text }}>
          {showRecoveryStep ? 'Save Recovery Code' : hasPin ? 'Unlock SecureChat' : 'Create a PIN'}
        </Text>
        {!showRecoveryStep && !resetMode ? (
          <TextInput
            className="mb-2 rounded-xl border p-3 text-lg"
            style={{ borderColor: palette.border, color: palette.text }}
            keyboardType="number-pad"
            secureTextEntry
            placeholder="••••••"
            value={value}
            onChangeText={(text) => {
              const sanitized = text.replace(/[^0-9]/g, '');
              setValue(sanitized);
            }}
          />
        ) : !showRecoveryStep ? (
          <>
            <TextInput
              className="mb-2 rounded-xl border p-3"
              style={{ borderColor: palette.border, color: palette.text }}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="16-digit recovery code"
              placeholderTextColor={palette.muted}
              value={recoveryCode}
              keyboardType="number-pad"
              onChangeText={(text) => setRecoveryCode(text.replace(/[^0-9]/g, '').slice(0, 16))}
            />
            <TextInput
              className="mb-2 rounded-xl border p-3 text-lg"
              style={{ borderColor: palette.border, color: palette.text }}
              keyboardType="number-pad"
              secureTextEntry
              placeholder="New PIN (6 digits)"
              placeholderTextColor={palette.muted}
              value={newPin}
              onChangeText={(text) => setNewPin(text.replace(/[^0-9]/g, '').slice(0, 6))}
            />
            <TextInput
              className="mb-2 rounded-xl border p-3 text-lg"
              style={{ borderColor: palette.border, color: palette.text }}
              keyboardType="number-pad"
              secureTextEntry
              placeholder="Confirm new PIN"
              placeholderTextColor={palette.muted}
              value={confirmNewPin}
              onChangeText={(text) => setConfirmNewPin(text.replace(/[^0-9]/g, '').slice(0, 6))}
            />
          </>
        ) : (
          <View>
            <Text className="mb-2 text-sm leading-5" style={{ color: palette.muted }}>
              Save this code now. If you forget your PIN, this recovery code is required to reset it without data loss.
            </Text>
            <Text className="mb-2 rounded-xl border p-3 text-base" style={{ color: palette.text, borderColor: palette.border }}>
              {createdRecoveryCode}
            </Text>
            <TouchableOpacity
              className="mt-1 items-center rounded-xl p-3"
              style={{ backgroundColor: palette.action }}
              onPress={() => void Clipboard.setStringAsync(createdRecoveryCode)}
            >
              <Text className="font-semibold text-white">Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="mt-2 items-center rounded-xl p-3"
              style={{ backgroundColor: palette.action }}
              onPress={() => handleSaveOrDownload(createdRecoveryCode)}
            >
              <Text className="font-semibold text-white">{Platform.OS === 'web' ? 'Download' : 'Save/Share'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="mt-2 items-center rounded-xl border p-3"
              style={{ borderColor: palette.border }}
              onPress={() => onUnlock(createdPin)}
            >
              <Text style={{ color: palette.text, fontWeight: '600' }}>I Saved It, Continue</Text>
            </TouchableOpacity>
          </View>
        )}
        {!!message && !showRecoveryStep && (
          <Text className="mt-1" style={{ color: palette.action }}>
            {message}
          </Text>
        )}
        {!showRecoveryStep ? (
        <TouchableOpacity
          className="mt-3 items-center rounded-xl p-3"
          style={{ backgroundColor: palette.action, opacity: busy ? 0.6 : 1 }}
          onPress={resetMode ? () => void handleForgotPinReset() : () => void handlePress()}
          disabled={busy}
        >
          <Text className="font-semibold text-white">
            {resetMode ? (busy ? 'Resetting…' : 'Reset PIN') : hasPin ? 'Unlock' : 'Save PIN'}
          </Text>
        </TouchableOpacity>
        ) : null}
        {hasPin ? (
          <TouchableOpacity
            className="mt-3 items-center p-2"
            onPress={() => {
              setMessage('');
              setResetMode((prev) => !prev);
            }}
            disabled={busy}
          >
            <Text style={{ color: palette.action, fontWeight: '600' }}>
              {resetMode ? 'Back to unlock' : 'Forgot PIN?'}
            </Text>
          </TouchableOpacity>
        ) : null}
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
