import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import * as Clipboard from 'expo-clipboard';

type Props = {
  visible: boolean;
  onClose: () => void;
  sessionId: string | null;
  navigation: NativeStackScreenProps<RootStackParamList, 'Settings'>['navigation'];
};

const SESSION_ID_RE = /[A-Za-z0-9]{66}/;

function extractSessionId(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^[A-Za-z0-9]{66}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(SESSION_ID_RE);
  return match ? match[0] : null;
}

const H_PAD = 16;
const MAX_CONTENT_WIDTH = 480;

export const SessionQrSheet: React.FC<Props> = ({ visible, onClose, sessionId, navigation }) => {
  const { palette } = useTheme();
  const { width, height } = useWindowDimensions();
  const [tab, setTab] = useState<'show' | 'scan'>('show');
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      scannedRef.current = false;
      setTab('show');
    }
  }, [visible]);

  const contentWidth = Math.min(width - H_PAD * 2, MAX_CONTENT_WIDTH);

  const qrSize = useMemo(() => {
    const inner = contentWidth - 32;
    const capped = Math.min(inner, height * 0.42);
    return Math.max(148, Math.floor(Math.min(capped, 300)));
  }, [contentWidth, height]);

  const cameraPreviewHeight = useMemo(() => {
    const byWidth = width * 0.92;
    const byHeight = height * 0.38;
    return Math.round(Math.min(Math.max(Math.min(byWidth, byHeight), 200), 440));
  }, [width, height]);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scannedRef.current) {
        return;
      }
      const id = extractSessionId(result.data);
      if (!id) {
        return;
      }
      scannedRef.current = true;
      onClose();
      navigation.navigate('NewChat', { prefilledSessionId: id });
    },
    [navigation, onClose]
  );

  const copySessionId = async () => {
    if (!sessionId) {
      return;
    }
    await Clipboard.setStringAsync(sessionId);
  };

  const canScan = Platform.OS !== 'web';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.background }} edges={['top', 'bottom', 'left', 'right']}>
        <View className="flex-1" style={{ maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
          <View
            className="flex-row items-center border-b px-4 py-3"
            style={{ borderColor: palette.border, paddingHorizontal: H_PAD }}
          >
            <View className="w-10" />
            <Text className="flex-1 text-center text-lg font-semibold" style={{ color: palette.text }}>
              QR Code
            </Text>
            <Pressable className="w-10 items-end" onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close" size={26} color={palette.text} />
            </Pressable>
          </View>

          <View className="flex-row pt-3" style={{ paddingHorizontal: H_PAD }}>
            <Pressable
              className="mr-2 min-h-[48px] flex-1 items-center justify-center rounded-xl py-2.5"
              style={{
                backgroundColor: tab === 'show' ? palette.action : palette.surface,
                borderWidth: tab === 'show' ? 0 : 1,
                borderColor: palette.border
              }}
              onPress={() => setTab('show')}
            >
              <Text className="font-semibold" style={{ color: tab === 'show' ? '#fff' : palette.text }}>
                My QR
              </Text>
            </Pressable>
            <Pressable
              className="min-h-[48px] flex-1 items-center justify-center rounded-xl py-2.5"
              style={{
                backgroundColor: tab === 'scan' ? palette.action : palette.surface,
                borderWidth: tab === 'scan' ? 0 : 1,
                borderColor: palette.border
              }}
              onPress={() => {
                setTab('scan');
                if (canScan && permission && !permission.granted) {
                  void requestPermission();
                }
              }}
            >
              <Text className="font-semibold" style={{ color: tab === 'scan' ? '#fff' : palette.text }}>
                Scan
              </Text>
            </Pressable>
          </View>

          {tab === 'show' ? (
            <ScrollView
              className="flex-1"
              contentContainerStyle={{
                flexGrow: 1,
                paddingHorizontal: H_PAD,
                paddingTop: 16,
                paddingBottom: 24
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text className="mb-4 text-center text-sm leading-5" style={{ color: palette.muted }}>
                Others can scan this code to copy your Session ID and start a chat with you.
              </Text>
              {sessionId ? (
                <View
                  className="items-center self-center rounded-2xl p-4"
                  style={{
                    width: '100%',
                    maxWidth: contentWidth,
                    backgroundColor: palette.card,
                    borderWidth: 1,
                    borderColor: palette.border
                  }}
                >
                  <QRCode
                    value={sessionId}
                    size={qrSize}
                    color={palette.text}
                    backgroundColor={palette.card}
                    quietZone={Math.max(6, Math.floor(qrSize * 0.03))}
                  />
                  <Text
                    className="mt-3 w-full text-center text-[11px] leading-[16px]"
                    style={{ color: palette.muted }}
                    selectable
                  >
                    {sessionId}
                  </Text>
                  <Pressable
                    className="mt-4 min-h-[48px] w-full max-w-[280px] flex-row items-center justify-center rounded-xl px-5 py-3"
                    style={{ backgroundColor: palette.action }}
                    onPress={() => void copySessionId()}
                  >
                    <Ionicons name="copy-outline" size={18} color="#fff" />
                    <Text className="ml-2 font-semibold text-white">Copy Session ID</Text>
                  </Pressable>
                </View>
              ) : (
                <Text className="text-center" style={{ color: palette.muted }}>
                  Session ID is not ready yet.
                </Text>
              )}
            </ScrollView>
          ) : (
            <View className="flex-1 pt-4" style={{ paddingHorizontal: H_PAD }}>
              {!canScan ? (
                <Text className="text-center text-sm leading-6" style={{ color: palette.muted }}>
                  QR scanning is available on the iOS and Android apps. On web, paste a Session ID manually when starting a
                  new chat.
                </Text>
              ) : !permission ? (
                <View className="flex-1 items-center justify-center py-8">
                  <ActivityIndicator color={palette.action} />
                </View>
              ) : !permission.granted ? (
                <View className="flex-1 items-center justify-center px-2 py-8">
                  <Text className="mb-4 text-center text-sm" style={{ color: palette.muted }}>
                    Camera access is needed to scan a Session ID QR code.
                  </Text>
                  <Pressable
                    className="min-h-[48px] justify-center rounded-xl px-6 py-3"
                    style={{ backgroundColor: palette.action }}
                    onPress={() => void requestPermission()}
                  >
                    <Text className="font-semibold text-white">Allow camera</Text>
                  </Pressable>
                </View>
              ) : (
                <View className="flex-1">
                  <Text className="mb-3 text-center text-sm leading-5" style={{ color: palette.muted }}>
                    Point the camera at a contact's Session ID QR. We will open New chat with their ID filled in.
                  </Text>
                  <View
                    className="overflow-hidden rounded-2xl"
                    style={{
                      height: cameraPreviewHeight,
                      width: '100%',
                      maxWidth: contentWidth,
                      alignSelf: 'center',
                      backgroundColor: '#000'
                    }}
                  >
                    <CameraView
                      style={{ flex: 1 }}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      onBarcodeScanned={handleBarcodeScanned}
                    />
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};
