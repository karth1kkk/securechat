import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { API_URL, GRAPHQL_URL } from '../config';

const PATH_INFO_URL = `${API_URL.replace(/\/$/, '')}/path-info`;

/** Used when GET /path-info is 404 (API image not updated yet). No Authorization header — avoids JWT 400 on public field.
 *  Omits apiAvailabilityZone / apiInstanceId so older GraphQL schemas still accept the query; those show on GET /path-info once deployed.
 */
const PATH_FALLBACK_GRAPHQL = `
  query PathFallbackNetworkInfo {
    secureChatNetworkInfo {
      apiRegion
      environment
      deploymentId
      version
      nodes {
        role
        label
        countryCode
        region
      }
    }
  }
`;

/** Session-style hop titles (values under each hop come from the API as AWS-enriched text). */
const SESSION_ROLE_LABELS: Record<'you' | 'entry' | 'service' | 'relay' | 'destination', string> = {
  you: 'You',
  entry: 'Entry node',
  service: 'Service node',
  relay: 'Relay',
  destination: 'Destination'
};

async function fetchPathPayload(signal: AbortSignal): Promise<SecureChatNetworkInfoPayload> {
  const res = await fetch(PATH_INFO_URL, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal
  });
  const text = await res.text();

  if (res.status === 404) {
    const gqlRes = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: PATH_FALLBACK_GRAPHQL }),
      signal
    });
    const gqlText = await gqlRes.text();
    if (!gqlRes.ok) {
      throw new Error(`HTTP ${gqlRes.status} (GraphQL fallback): ${gqlText.slice(0, 500)}`);
    }
    const json = JSON.parse(gqlText) as {
      data?: { secureChatNetworkInfo?: SecureChatNetworkInfoPayload };
      errors?: { message: string }[];
    };
    if (json.errors?.length) {
      throw new Error(json.errors.map((e) => e.message).join('; '));
    }
    const info = json.data?.secureChatNetworkInfo;
    if (!info) {
      throw new Error('GraphQL fallback: empty secureChatNetworkInfo');
    }
    return info;
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as SecureChatNetworkInfoPayload;
}

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

type SecureChatNetworkInfoPayload = {
  apiRegion?: string | null;
  apiAvailabilityZone?: string | null;
  apiInstanceId?: string | null;
  environment?: string | null;
  deploymentId?: string | null;
  version?: string | null;
  nodes?: NetworkNode[];
};

function emDashWhenEmpty(value: string | null | undefined): string {
  const t = value?.trim();
  return t && t.length > 0 ? t : '—';
}

type AwsPlacementRow = { label: string; value: string; hint?: string };

function buildAwsPlacementRows(info: SecureChatNetworkInfoPayload | undefined): AwsPlacementRow[] {
  if (!info) {
    return [];
  }
  return [
    {
      label: 'AWS Region',
      value: emDashWhenEmpty(info.apiRegion),
      hint: 'Region for this API process (env or instance metadata).'
    },
    {
      label: 'Availability zone',
      value: emDashWhenEmpty(info.apiAvailabilityZone),
      hint: 'Single AZ where this API runs on EC2/ECS. ALB below spans every AZ you enabled on the load balancer.'
    },
    {
      label: 'EC2 instance',
      value: emDashWhenEmpty(info.apiInstanceId),
      hint: 'Instance running the API container when reported (IMDS or EC2_INSTANCE_ID).'
    },
    {
      label: 'Deployment',
      value: emDashWhenEmpty(info.deploymentId),
      hint: 'Task ARN on ECS, or instance id / label from configuration.'
    },
    {
      label: 'Environment',
      value: emDashWhenEmpty(info.environment),
      hint: 'ASPNETCORE_ENVIRONMENT for this API.'
    },
    {
      label: 'API version',
      value: emDashWhenEmpty(info.version),
      hint: 'Assembly version of the running backend.'
    }
  ];
}

function awsPlacementReported(info: SecureChatNetworkInfoPayload | undefined): boolean {
  if (!info) {
    return false;
  }
  return Boolean(
    info.apiRegion?.trim() ||
      info.apiAvailabilityZone?.trim() ||
      info.apiInstanceId?.trim() ||
      info.deploymentId?.trim()
  );
}

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

export const PathScreen: React.FC<NativeStackScreenProps<RootStackParamList, 'Path'>> = () => {
  const { palette } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  const [networkInfo, setNetworkInfo] = useState<SecureChatNetworkInfoPayload | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPathPayload(signal);
      setNetworkInfo(data);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        return;
      }
      setNetworkInfo(undefined);
      setError(e instanceof Error ? e : new Error('Request failed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      void reload(controller.signal);
      return () => controller.abort();
    }, [reload])
  );

  const pathNodes: NetworkNode[] = useMemo(() => networkInfo?.nodes ?? [], [networkInfo]);
  const awsRows = useMemo(() => buildAwsPlacementRows(networkInfo), [networkInfo]);
  const hasAwsPlacement = useMemo(() => awsPlacementReported(networkInfo), [networkInfo]);

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
      <View className="flex-1 items-center justify-center p-5" style={{ backgroundColor: palette.background }}>
        <ActivityIndicator size="large" color={palette.action} />
        <Text className="mt-3 text-sm" style={{ color: palette.muted }}>
          Loading path…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center p-5" style={{ backgroundColor: palette.background }}>
        <Text className="text-lg font-semibold" style={{ color: palette.text }}>
          Could not load path
        </Text>
        <Text className="mt-2 text-center text-sm" style={{ color: palette.muted }}>
          {error.message}
        </Text>
        <Text className="mt-2 text-center text-[12px] leading-4" style={{ color: palette.muted }} selectable>
          GET (no auth):{'\n'}
          {PATH_INFO_URL}
        </Text>
        <Text className="mt-3 text-center text-[13px] leading-[18px]" style={{ color: palette.muted }}>
          If GET /path-info returns 404, this build automatically retries GraphQL without an Authorization header. For
          AWS-enriched hop text, deploy the latest SecureChat backend (includes GET /path-info and updated region
          strings). EXPO_PUBLIC_API_URL / EXPO_PUBLIC_GRAPHQL_URL must point at this API.
        </Text>
        <Pressable
          className="mt-5 rounded-xl px-6 py-3"
          style={{ backgroundColor: palette.action }}
          onPress={() => {
            const ac = new AbortController();
            void reload(ac.signal);
          }}
        >
          <Text className="text-base font-semibold" style={{ color: palette.background }}>
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  if (pathNodes.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-5" style={{ backgroundColor: palette.background }}>
        <Text className="text-sm" style={{ color: palette.muted }}>
          No routing nodes configured.
        </Text>
        <Pressable
          className="mt-4 rounded-xl px-6 py-3"
          style={{ backgroundColor: palette.action }}
          onPress={() => {
            const ac = new AbortController();
            void reload(ac.signal);
          }}
        >
          <Text className="text-base font-semibold" style={{ color: palette.background }}>
            Refresh
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 32, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text className="mb-2 text-[28px] font-bold" style={{ color: palette.text }}>
        Path
      </Text>
      <Text className="mb-3 text-sm leading-5" style={{ color: palette.muted }}>
        Session-style hops (You → Entry → Service → Relay → Destination). Values under each hop are AWS-oriented text
        from the API (Region, AZ, ALB, EC2, RDS). Data is loaded with GET /path-info (no GraphQL, no JWT).
      </Text>

      <View className="mb-5 rounded-2xl border p-4" style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
        <Text className="mb-3 text-base font-semibold" style={{ color: palette.text }}>
          {'AWS & placement'}
        </Text>
        {awsRows.map((row) => (
          <View key={row.label} className="mb-3 border-b pb-3 last:mb-0 last:border-b-0 last:pb-0" style={{ borderBottomColor: palette.border }}>
            <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: palette.muted }}>
              {row.label}
            </Text>
            <Text className="mt-1 text-[15px] leading-[22px]" style={{ color: palette.text }}>
              {row.value}
            </Text>
            {row.hint ? (
              <Text className="mt-1 text-[12px] leading-[16px]" style={{ color: palette.muted }}>
                {row.hint}
              </Text>
            ) : null}
          </View>
        ))}
        {!hasAwsPlacement ? (
          <Text className="text-[13px] leading-[18px]" style={{ color: palette.muted }}>
            Region / AZ / instance were not detected (common for local dev, or Docker without IMDS). On EC2 you can set
            AWS_REGION, EC2_INSTANCE_ID, and optionally the AZ in env so this card fills in without IMDS from the
            container network.
          </Text>
        ) : null}
      </View>

      <Text className="mb-2 text-sm font-semibold" style={{ color: palette.text }}>
        Traffic path
      </Text>
      <View className="relative flex-1 pl-6">
        <View className="absolute bottom-6 left-[26px] top-7 w-0.5" style={{ backgroundColor: palette.border }} />
        {pathNodes.map((node, index) => {
          const kind = normalizeRole(node.role);
          const meta = formatNodeMeta(node);
          const hopTitle = SESSION_ROLE_LABELS[kind] ?? node.label;
          const showConfigLabel = node.label.trim().length > 0 && node.label.trim() !== hopTitle;
          return (
            <View key={`${node.role}-${node.label}-${index}`} className="mb-6 flex-row items-start pl-3">
              <View className="w-[52px] items-center">
                <Animated.View
                  className="h-5 w-5 rounded-[10px]"
                  style={{
                    backgroundColor: palette.action,
                    shadowColor: palette.glow,
                    shadowOffset: { width: 0, height: 0 },
                    shadowRadius: 12,
                    shadowOpacity: 0.9,
                    transform: [{ scale }]
                  }}
                />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold" style={{ color: palette.text }}>
                  {hopTitle}
                </Text>
                {showConfigLabel ? (
                  <Text className="mt-0.5 text-xs" style={{ color: palette.muted }}>
                    {node.label}
                  </Text>
                ) : null}
                {meta ? (
                  <Text className="mt-1 text-sm leading-5" style={{ color: palette.muted }}>
                    {meta}
                  </Text>
                ) : null}
                {kind === 'you' ? (
                  <Text
                    className="mt-1.5 self-start rounded-xl border px-2.5 py-1 text-xs"
                    style={{ color: palette.text, borderColor: palette.border }}
                  >
                    You
                  </Text>
                ) : null}
                {kind === 'entry' ? (
                  <Text
                    className="mt-1.5 self-start rounded-xl border px-2.5 py-1 text-xs"
                    style={{ color: palette.text, borderColor: palette.border }}
                  >
                    Entry
                  </Text>
                ) : null}
                {kind === 'service' ? (
                  <Text
                    className="mt-1.5 self-start rounded-xl border px-2.5 py-1 text-xs"
                    style={{ color: palette.text, borderColor: palette.border }}
                  >
                    Service
                  </Text>
                ) : null}
                {kind === 'relay' ? (
                  <Text
                    className="mt-1.5 self-start rounded-xl border px-2.5 py-1 text-xs"
                    style={{ color: palette.text, borderColor: palette.border }}
                  >
                    Relay
                  </Text>
                ) : null}
                {kind === 'destination' ? (
                  <Text
                    className="mt-1.5 self-start rounded-xl border px-2.5 py-1 text-xs"
                    style={{ color: palette.text, borderColor: palette.border }}
                  >
                    Destination
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};
