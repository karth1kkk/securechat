import React, { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@apollo/client';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { SECURE_CHAT_NETWORK_INFO } from '../graphql/queries';

export const SecureChatNetworkScreen: React.FC<
  NativeStackScreenProps<RootStackParamList, 'SecureChatNetwork'>
> = () => {
  const { palette } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const { data, loading, refetch } = useQuery(SECURE_CHAT_NETWORK_INFO, {
    fetchPolicy: 'cache-and-network'
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const info = data?.secureChatNetworkInfo;

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.action} />
      }
    >
      <Text className="mb-3 text-2xl font-bold" style={{ color: palette.text }}>
        SecureChat Network
      </Text>
      <Text className="mb-5 text-[15px] leading-[22px]" style={{ color: palette.muted }}>
        SecureChat uses end-to-end encryption: your messages are encrypted on your device. The server stores
        only ciphertext and relay metadata—it cannot read message content. This is different from Session’s
        decentralized onion routing; traffic between the app and this service uses TLS to our API and
        WebSockets to the realtime hub.
      </Text>

      <View className="mb-4 rounded-2xl border p-4" style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
        <Text className="mb-3 text-base font-semibold" style={{ color: palette.text }}>
          Network
        </Text>
        {loading && !info ? (
          <ActivityIndicator size="small" color={palette.action} style={{ marginVertical: 8 }} />
        ) : (
          <>
            <MetaRow label="Environment" value={info?.environment} palette={palette} />
            <MetaRow label="API region" value={info?.apiRegion} palette={palette} />
            <MetaRow label="Deployment" value={info?.deploymentId} palette={palette} />
            <MetaRow label="Backend version" value={info?.version} palette={palette} />
          </>
        )}
      </View>
    </ScrollView>
  );
};

const MetaRow = ({
  label,
  value,
  palette
}: {
  label: string;
  value?: string | null;
  palette: { muted: string; text: string };
}) => (
  <View className="mb-2.5">
    <Text className="mb-0.5 text-[13px]" style={{ color: palette.muted }}>
      {label}
    </Text>
    <Text className="text-[15px]" style={{ color: palette.text }}>
      {value?.trim() || '—'}
    </Text>
  </View>
);
