import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Donate'>;

const KOFI_URL = 'https://ko-fi.com';

export const DonateScreen: React.FC<Props> = () => {
  const { palette } = useTheme();

  const openExternal = (url: string) => {
    void Linking.openURL(url);
  };

  return (
    <ScrollView className="flex-1 px-4 py-4" style={{ backgroundColor: palette.background }}>
      <Text className="mb-3 text-lg font-semibold" style={{ color: palette.text }}>
        Support SecureChat
      </Text>
      <Text className="mb-4 text-sm leading-6" style={{ color: palette.muted }}>
        Tips and donations help cover hosting, security review, and ongoing development. For in-app digital tips,
        Apple and Google often require in-app purchases; this screen uses the browser for voluntary contributions so
        you can use the payment method you prefer.
      </Text>

      <Pressable
        className="mb-3 rounded-xl px-4 py-3"
        style={{ backgroundColor: palette.action }}
        onPress={() => openExternal(KOFI_URL)}
      >
        <Text className="text-center font-semibold text-white">Open Ko-fi (example)</Text>
      </Pressable>

      <Text className="mb-2 text-sm font-medium" style={{ color: palette.text }}>
        Other options
      </Text>
      <Text className="mb-2 text-sm" style={{ color: palette.muted }}>
        • Stripe Checkout or a donation link on your own site{'\n'}
        • GitHub Sponsors or Open Collective for open-source projects{'\n'}
        • RevenueCat + store billing if you later add tip jars inside the app stores
      </Text>

      <Text className="mt-4 text-xs leading-5" style={{ color: palette.muted }}>
        Replace the Ko-fi URL with your campaign link. This flow opens Safari or Chrome; it is not an in-app purchase.
      </Text>
    </ScrollView>
  );
};
