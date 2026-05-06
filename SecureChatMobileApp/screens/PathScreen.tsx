import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';
import { API_URL, GRAPHQL_URL } from '../config';

const PATH_INFO_URL = `${API_URL.replace(/\/$/, '')}/path-info`;

/** Used when GET /path-info is 404 (API image not updated yet). No Authorization header — avoids JWT 400 on public field. */
const PATH_FALLBACK_GRAPHQL = `
  query PathFallbackNetworkInfo {
    secureChatNetworkInfo {
      apiRegion
      apiAvailabilityZone
      apiInstanceId
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

const SESSION_ROLE_LABELS: Record<'you' | 'entry' | 'service' | 'relay' | 'destination', string> = {
  you: 'You',
  entry: 'Entry node',
  service: 'Service node',
  relay: 'Relay',
  destination: 'Destination'
};

/** Session-style path trace: neon green on dark, deeper green on light. */
function pathTraceColors(isDark: boolean): { line: string; dot: string; dotGlow: string } {
  if (isDark) {
    return {
      line: 'rgba(248,250,252,0.22)',
      dot: '#4ADE80',
      dotGlow: 'rgba(74,222,128,0.45)'
    };
  }
  return {
    line: 'rgba(15,23,42,0.15)',
    dot: '#16A34A',
    dotGlow: 'rgba(22,163,74,0.25)'
  };
}

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

function serviceHopIndices(pathNodes: NetworkNode[]): number[] {
  return pathNodes
    .map((n, i) => (normalizeRole(n.role) === 'service' ? i : -1))
    .filter((i): i is number => i >= 0);
}

/** Secondary line under each hop: AWS region/AZ on API tier; sensible fallbacks when the API omits node.region (common on older hosts). */
function buildHopSubtitle(
  node: NetworkNode,
  index: number,
  kind: 'you' | 'entry' | 'service' | 'relay' | 'destination',
  info: SecureChatNetworkInfoPayload | undefined,
  pathNodes: NetworkNode[]
): string {
  const region = info?.apiRegion?.trim();
  const az = info?.apiAvailabilityZone?.trim();
  const meta = formatNodeMeta(node);

  if (kind === 'you') {
    return 'This device';
  }

  if (kind === 'entry') {
    if (meta) {
      return meta;
    }
    if (region) {
      return region;
    }
    return 'Application load balancer';
  }

  if (kind === 'service') {
    const svcIdx = serviceHopIndices(pathNodes);
    const ordinal = svcIdx.indexOf(index);

    if (ordinal === 0) {
      // Prefer server-enriched node.region first — it bundles EC2/region/AZ/instance when IMDS/ECS exposes AZ,
      // and avoids showing only bare apiRegion while dropping AZ when the GraphQL body omitted top-level AZ fields.
      if (meta) {
        return meta;
      }
      if (region && az) {
        return `${region} · ${az}`;
      }
      if (region) {
        return region;
      }
      if (az) {
        return az;
      }
      return 'SecureChat API';
    }

    if (meta) {
      return meta;
    }

    const label = node.label?.trim();
    const primaryLine =
      region && az ? `${region} · ${az}` : region ? region : az ? az : '';
    const firstSvcIdx = svcIdx[0];
    const firstLine =
      firstSvcIdx !== undefined
        ? buildHopSubtitle(pathNodes[firstSvcIdx]!, firstSvcIdx, 'service', info, pathNodes)
        : '';

    if (primaryLine && primaryLine !== firstLine) {
      return primaryLine;
    }
    if (label) {
      return `${label}${region ? ` · ${region}` : ''}`;
    }
    if (region && az) {
      return `${region} · ${az}`;
    }
    if (region) {
      return `${region} · same Region`;
    }
    if (az) {
      return az;
    }
    return 'Realtime / internal tier';
  }

  if (kind === 'relay') {
    if (meta) {
      return meta;
    }
    if (region) {
      return `Same AWS region · ${region}`;
    }
    return 'Relay path';
  }

  if (kind === 'destination') {
    if (meta) {
      return meta;
    }
    if (region && az) {
      return `Amazon RDS · ${region} · ${az}`;
    }
    if (region) {
      return `Amazon RDS · ${region}`;
    }
    if (az) {
      return `Data store · ${az}`;
    }
    const label = node.label?.trim();
    if (label) {
      return label;
    }
    return 'Encrypted PostgreSQL';
  }

  return meta ?? region ?? '—';
}

const DOT_YOU = 16;
const DOT_OTHER = 10;
const SEG_ABOVE = 14;
const SEG_BELOW = 22;

export const PathScreen: React.FC<NativeStackScreenProps<RootStackParamList, 'Path'>> = () => {
  const { width: windowWidth } = useWindowDimensions();
  const { palette, preference } = useTheme();
  const isDark = preference.mode === 'dark';
  const trace = useMemo(() => pathTraceColors(isDark), [isDark]);
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

  const youScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12]
  });

  const { padH, contentMaxWidth, introFontSize, hopTitleSize, hopSubtitleSize } = useMemo(() => {
    const isWide = windowWidth >= 768;
    const isTablet = windowWidth >= 480;
    const pad = isWide ? 40 : isTablet ? 28 : 20;
    const inner = Math.max(windowWidth - pad * 2, 260);
    const cap = isWide ? 680 : isTablet ? 560 : 420;
    const maxW = Math.min(inner, cap);
    return {
      padH: pad,
      contentMaxWidth: maxW,
      introFontSize: isWide ? 17 : 16,
      hopTitleSize: isWide ? 18 : 17,
      hopSubtitleSize: isWide ? 15 : 14
    };
  }, [windowWidth]);

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

  const lastIndex = pathNodes.length - 1;

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={{
        paddingHorizontal: padH,
        paddingTop: windowWidth >= 768 ? 16 : 8,
        paddingBottom: 40,
        flexGrow: 1,
        alignItems: 'center',
        width: '100%',
        alignSelf: 'center',
        maxWidth: Math.min(windowWidth, 920)
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ width: '100%', maxWidth: contentMaxWidth }}>
        <Text
          className="mb-8 text-center leading-[24px]"
          style={{ color: palette.muted, fontSize: introFontSize, lineHeight: introFontSize * 1.45 }}
        >
          Session routes messages through several hops in its decentralized network. SecureChat uses TLS to this service
          instead; the diagram below shows how your traffic reaches our infrastructure, including{' '}
          <Text style={{ color: palette.text, fontWeight: '600' }}>AWS region</Text> and{' '}
          <Text style={{ color: palette.text, fontWeight: '600' }}>availability zone</Text> where the API reports them.
        </Text>
      </View>

      <View className="pb-6" style={{ width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }}>
        {pathNodes.map((node, index) => {
          const kind = normalizeRole(node.role);
          const hopTitle = SESSION_ROLE_LABELS[kind] ?? node.label;
          const subtitle = buildHopSubtitle(node, index, kind, networkInfo, pathNodes);
          const isYou = kind === 'you';
          const dotSize = isYou ? DOT_YOU : DOT_OTHER;
          const showLineAbove = index > 0;
          const showLineBelow = index < lastIndex;

          return (
            <View key={`${node.role}-${node.label}-${index}`} className="flex-row w-full">
              <View className="items-center" style={{ width: windowWidth >= 768 ? 40 : 32 }}>
                {showLineAbove ? (
                  <View style={{ width: 2, height: SEG_ABOVE, backgroundColor: trace.line }} />
                ) : null}
                {isYou ? (
                  <Animated.View
                    style={{
                      width: dotSize,
                      height: dotSize,
                      borderRadius: dotSize / 2,
                      backgroundColor: trace.dot,
                      shadowColor: trace.dotGlow,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 1,
                      shadowRadius: 14,
                      elevation: 8,
                      transform: [{ scale: youScale }]
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: dotSize,
                      height: dotSize,
                      borderRadius: dotSize / 2,
                      backgroundColor: trace.dot
                    }}
                  />
                )}
                {showLineBelow ? (
                  <View style={{ width: 2, height: SEG_BELOW, backgroundColor: trace.line }} />
                ) : null}
              </View>

              <View className="min-w-0 flex-1 shrink" style={{ paddingLeft: windowWidth >= 768 ? 18 : 14, paddingBottom: index < lastIndex ? 6 : 0 }}>
                <Text
                  className="font-semibold tracking-tight"
                  style={{ color: palette.text, marginTop: showLineAbove ? -4 : 0, fontSize: hopTitleSize }}
                >
                  {hopTitle}
                </Text>
                <Text
                  className="mt-1"
                  style={{
                    color: palette.muted,
                    fontSize: hopSubtitleSize,
                    lineHeight: hopSubtitleSize * 1.45
                  }}
                >
                  {subtitle}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <Pressable
        className="mt-4 self-center rounded-full border-2 px-8 py-3.5"
        style={{ borderColor: palette.action, backgroundColor: 'transparent' }}
        onPress={() => void Linking.openURL('https://getsession.org')}
      >
        <Text className="text-[15px] font-semibold" style={{ color: palette.action }}>
          Learn more
        </Text>
      </Pressable>
    </ScrollView>
  );
};
