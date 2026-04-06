import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { ApolloError, useQuery } from '@apollo/client';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { SECURE_CHAT_NETWORK_INFO } from '../graphql/queries';

type NetworkPathRole =
  | 'YOU'
  | 'ENTRY_NODE'
  | 'SERVICE_NODE'
  | 'RELAY'
  | 'DESTINATION'
  | string;

type NetworkNode = {
  role: NetworkPathRole;
  label: string;
  countryCode?: string | null;
  region?: string | null;
};

function normalizeRole(role: string): 'you' | 'entry' | 'service' | 'relay' | 'destination' {
  const r = role.toUpperCase();
  if (r === 'YOU') return 'you';
  if (r === 'ENTRY_NODE' || r === 'ENTRYNODE') return 'entry';
  if (r === 'SERVICE_NODE' || r === 'SERVICENODE') return 'service';
  if (r === 'RELAY') return 'relay';
  if (r === 'DESTINATION') return 'destination';
  return 'service';
}

function formatNodeMeta(node: NetworkNode): string | undefined {
  const parts = [node.region, node.countryCode].filter((p): p is string => !!p && p.trim().length > 0);
  if (parts.length === 0) {
    return undefined;
  }
  return parts.join(' · ');
}

function describePathLoadError(error: ApolloError): { detail: string; hint?: string } {
  const gqlLines = error.graphQLErrors?.map((e) => e.message).filter(Boolean) ?? [];
  const detail =
    gqlLines.length > 0 ? gqlLines.join('\n') : error.message || 'Request failed';
  const looksLikeMissingField =
    gqlLines.some(
      (m) =>
        m.includes('does not exist') ||
        m.includes('Unknown field') ||
        m.includes('secureChatNetworkInfo')
    ) ||
    (error.networkError && 'statusCode' in error.networkError && error.networkError.statusCode === 400);
  const hint = looksLikeMissingField
    ? 'The Path screen needs the latest SecureChat backend (GraphQL field secureChatNetworkInfo). Stop the API, run dotnet build in SecureChatBackend, start it again, and confirm GRAPHQL_URL in .env matches that process.'
    : undefined;
  return { detail, hint };
}

export const PathScreen: React.FC<NativeStackScreenProps<RootStackParamList, 'Path'>> = () => {
  const { palette } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  const { data, loading, error, refetch } = useQuery(SECURE_CHAT_NETWORK_INFO, {
    fetchPolicy: 'network-only'
  });

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const pathNodes: NetworkNode[] = useMemo(() => data?.secureChatNetworkInfo?.nodes ?? [], [data]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true
        })
      ])
    ).start();
  }, [pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.25]
  });

  if (loading && pathNodes.length === 0) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.action} />
        <Text style={[styles.muted, { color: palette.muted, marginTop: 12 }]}>Loading path…</Text>
      </View>
    );
  }

  if (error) {
    const apollo = error instanceof ApolloError ? error : null;
    const { detail, hint } = apollo ? describePathLoadError(apollo) : { detail: error.message, hint: undefined };
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: palette.background }]}>
        <Text style={[styles.errorText, { color: palette.text }]}>Could not load path</Text>
        <Text style={[styles.muted, { color: palette.muted, marginTop: 8, textAlign: 'center' }]}>
          {detail}
        </Text>
        {hint ? (
          <Text style={[styles.hint, { color: palette.muted, marginTop: 12, textAlign: 'center' }]}>{hint}</Text>
        ) : null}
        <Pressable
          style={[styles.retry, { backgroundColor: palette.action }]}
          onPress={() => void refetch()}
        >
          <Text style={[styles.retryLabel, { color: palette.background }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (pathNodes.length === 0) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: palette.background }]}>
        <Text style={[styles.muted, { color: palette.muted }]}>No routing nodes configured.</Text>
        <Pressable
          style={[styles.retry, { marginTop: 16, backgroundColor: palette.action }]}
          onPress={() => void refetch()}
        >
          <Text style={[styles.retryLabel, { color: palette.background }]}>Refresh</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <Text style={[styles.header, { color: palette.text }]}>Path</Text>
      <Text style={[styles.subtitle, { color: palette.muted }]}>
        Hops between your device and the SecureChat service (from server configuration).
      </Text>
      <View style={styles.timelineContainer}>
        <View style={[styles.timelineLine, { backgroundColor: palette.border }]} />
        {pathNodes.map((node, index) => {
          const kind = normalizeRole(node.role);
          const meta = formatNodeMeta(node);
          return (
            <View key={`${node.label}-${index}`} style={styles.nodeRow}>
              <View style={styles.dotContainer}>
                <Animated.View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: palette.action,
                      shadowColor: palette.glow,
                      transform: [{ scale }]
                    }
                  ]}
                />
              </View>
              <View style={styles.nodeContent}>
                <Text style={[styles.nodeTitle, { color: palette.text }]}>{node.label}</Text>
                {meta ? <Text style={[styles.nodeMeta, { color: palette.muted }]}>{meta}</Text> : null}
                {kind === 'service' && (
                  <Text style={[styles.nodeChip, { color: palette.text, borderColor: palette.border }]}>
                    Service
                  </Text>
                )}
                {kind === 'entry' && (
                  <Text style={[styles.nodeChip, { color: palette.text, borderColor: palette.border }]}>
                    Entry
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16
  },
  muted: {
    fontSize: 14
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600'
  },
  hint: {
    fontSize: 13,
    lineHeight: 18
  },
  retry: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12
  },
  retryLabel: {
    fontSize: 16,
    fontWeight: '600'
  },
  timelineContainer: {
    flex: 1,
    paddingLeft: 24,
    position: 'relative'
  },
  timelineLine: {
    position: 'absolute',
    left: 26,
    top: 28,
    bottom: 24,
    width: 2
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingLeft: 12
  },
  dotContainer: {
    width: 52,
    alignItems: 'center'
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    shadowOpacity: 0.9
  },
  nodeContent: {
    flex: 1
  },
  nodeTitle: {
    fontSize: 18,
    fontWeight: '600'
  },
  nodeMeta: {
    fontSize: 14,
    marginTop: 4
  },
  nodeChip: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 12
  }
});
