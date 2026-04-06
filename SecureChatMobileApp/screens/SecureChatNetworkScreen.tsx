import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
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
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.action} />
      }
    >
      <Text style={[styles.title, { color: palette.text }]}>SecureChat Network</Text>
      <Text style={[styles.body, { color: palette.muted }]}>
        SecureChat uses end-to-end encryption: your messages are encrypted on your device. The server stores
        only ciphertext and relay metadata—it cannot read message content. This is different from Session’s
        decentralized onion routing; traffic between the app and this service uses TLS to our API and
        WebSockets to the realtime hub.
      </Text>

      <View style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Connection checks</Text>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>Backend (HTTP)</Text>
          {graphqlStatus === 'checking' ? (
            <ActivityIndicator size="small" color={palette.action} />
          ) : (
            <Text style={[styles.rowValue, { color: statusColor(graphqlStatus) }]}>
              {statusLabel(graphqlStatus)}
            </Text>
          )}
        </View>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: palette.text }]}>SignalR hub</Text>
          {signalRStatus === 'checking' ? (
            <ActivityIndicator size="small" color={palette.action} />
          ) : (
            <Text style={[styles.rowValue, { color: statusColor(signalRStatus) }]}>
              {statusLabel(signalRStatus)}
            </Text>
          )}
        </View>
        <Pressable
          style={[styles.retryBtn, { borderColor: palette.border }]}
          onPress={() => void runProbes()}
        >
          <Text style={[styles.retryText, { color: palette.text }]}>Test again</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>Deployment</Text>
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
  <View style={styles.metaRow}>
    <Text style={[styles.metaLabel, { color: palette.muted }]}>{label}</Text>
    <Text style={[styles.metaValue, { color: palette.text }]}>{value?.trim() || '—'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    padding: 20,
    paddingBottom: 40
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  rowLabel: {
    fontSize: 15
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '600'
  },
  retryBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600'
  },
  metaRow: {
    marginBottom: 10
  },
  metaLabel: {
    fontSize: 13,
    marginBottom: 2
  },
  metaValue: {
    fontSize: 15
  }
});
