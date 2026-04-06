import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { SECURE_CHAT_NETWORK_INFO } from '../graphql/queries';
import { API_URL } from '../config';
import { sessionService } from '../services/sessionService';
import { SignalRService } from '../services/signalrService';

type ConnState = 'checking' | 'ok' | 'error';

async function probeGraphqlHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL.replace(/\/$/, '')}/health`);
    const text = await res.text();
    return res.ok && text.trim() === 'ok';
  } catch {
    return false;
  }
}

async function probeSignalR(): Promise<boolean> {
  const session = await sessionService.getSession();
  const hub = new SignalRService();
  try {
    await hub.start(session?.jwtToken);
    return hub.isConnected();
  } catch {
    return false;
  } finally {
    await hub.stop();
  }
}

export const SecureChatNetworkScreen: React.FC<
  NativeStackScreenProps<RootStackParamList, 'SecureChatNetwork'>
> = () => {
  const { palette } = useTheme();
  const [graphqlStatus, setGraphqlStatus] = useState<ConnState>('checking');
  const [signalRStatus, setSignalRStatus] = useState<ConnState>('checking');
  const [refreshing, setRefreshing] = useState(false);

  const { data, loading, refetch } = useQuery(SECURE_CHAT_NETWORK_INFO, {
    fetchPolicy: 'cache-and-network'
  });

  const runProbes = useCallback(async () => {
    setGraphqlStatus('checking');
    setSignalRStatus('checking');
    const [gOk, sOk] = await Promise.all([probeGraphqlHealth(), probeSignalR()]);
    setGraphqlStatus(gOk ? 'ok' : 'error');
    setSignalRStatus(sOk ? 'ok' : 'error');
  }, []);

  useFocusEffect(
    useCallback(() => {
      void runProbes();
    }, [runProbes])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      await runProbes();
    } finally {
      setRefreshing(false);
    }
  };

  const info = data?.secureChatNetworkInfo;

  const statusLabel = (s: ConnState) => {
    if (s === 'checking') {
      return 'Checking…';
    }
    if (s === 'ok') {
      return 'Connected';
    }
    return 'Unreachable';
  };

  const statusColor = (s: ConnState) => {
    if (s === 'checking') {
      return palette.muted;
    }
    if (s === 'ok') {
      return palette.action;
    }
    return '#e5484d';
  };

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
          Connection checks
        </Text>
        <View className="mb-2.5 flex-row items-center justify-between">
          <Text className="text-[15px]" style={{ color: palette.text }}>
            Backend (HTTP)
          </Text>
          {graphqlStatus === 'checking' ? (
            <ActivityIndicator size="small" color={palette.action} />
          ) : (
            <Text className="text-[15px] font-semibold" style={{ color: statusColor(graphqlStatus) }}>
              {statusLabel(graphqlStatus)}
            </Text>
          )}
        </View>
        <View className="mb-2.5 flex-row items-center justify-between">
          <Text className="text-[15px]" style={{ color: palette.text }}>
            SignalR hub
          </Text>
          {signalRStatus === 'checking' ? (
            <ActivityIndicator size="small" color={palette.action} />
          ) : (
            <Text className="text-[15px] font-semibold" style={{ color: statusColor(signalRStatus) }}>
              {statusLabel(signalRStatus)}
            </Text>
          )}
        </View>
        <Pressable
          className="mt-2 self-start rounded-[10px] border px-3.5 py-2"
          style={{ borderColor: palette.border }}
          onPress={() => void runProbes()}
        >
          <Text className="text-sm font-semibold" style={{ color: palette.text }}>
            Test again
          </Text>
        </Pressable>
      </View>

      <View className="mb-4 rounded-2xl border p-4" style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
        <Text className="mb-3 text-base font-semibold" style={{ color: palette.text }}>
          Deployment
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
