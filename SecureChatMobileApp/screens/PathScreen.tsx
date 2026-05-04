import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, Text, View } from 'react-native';
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

function awsComponentHintForNode(
  kind: 'you' | 'entry' | 'service' | 'relay' | 'destination',
  apiAz: string | null | undefined
): string | null {
  if (kind === 'entry') {
    return 'AWS: Application Load Balancer (HTTPS, ACM). Distributes requests across targets in each enabled AZ.';
  }
  if (kind === 'service') {
    const az = apiAz?.trim();
    if (az) {
      return `AWS: API host in ${az} (see placement above).`;
    }
    return 'AWS: API & GraphQL on this host (AZ above when reported).';
  }
  if (kind === 'destination') {
    return 'AWS: Amazon RDS for PostgreSQL in this Region (Multi-AZ is configured in RDS, not shown here).';
  }
  return null;
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

  const networkInfo = data?.secureChatNetworkInfo as SecureChatNetworkInfoPayload | undefined;
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
    const apollo = error instanceof ApolloError ? error : null;
    const { detail, hint } = apollo ? describePathLoadError(apollo) : { detail: error.message, hint: undefined };
    return (
      <View className="flex-1 items-center justify-center p-5" style={{ backgroundColor: palette.background }}>
        <Text className="text-lg font-semibold" style={{ color: palette.text }}>
          Could not load path
        </Text>
        <Text className="mt-2 text-center text-sm" style={{ color: palette.muted }}>
          {detail}
        </Text>
        {hint ? (
          <Text className="mt-3 text-center text-[13px] leading-[18px]" style={{ color: palette.muted }}>
            {hint}
          </Text>
        ) : null}
        <Pressable className="mt-5 rounded-xl px-6 py-3" style={{ backgroundColor: palette.action }} onPress={() => void refetch()}>
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
        <Pressable className="mt-4 rounded-xl px-6 py-3" style={{ backgroundColor: palette.action }} onPress={() => void refetch()}>
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
        Hops from your device to SecureChat. The API reports its AWS Region and (when EC2/ECS metadata or env vars are
        available) the single availability zone where this API process runs. The TLS entry hop is an Application Load
        Balancer: it is regional and uses every AZ you attached to the listener subnets.
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
          const awsHop = awsComponentHintForNode(kind, networkInfo?.apiAvailabilityZone);
          return (
            <View key={`${node.label}-${index}`} className="mb-6 flex-row items-start pl-3">
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
                  {node.label}
                </Text>
                {meta ? (
                  <Text className="mt-1 text-sm" style={{ color: palette.muted }}>
                    {meta}
                  </Text>
                ) : null}
                {awsHop ? (
                  <Text className="mt-1.5 text-[12px] leading-[16px]" style={{ color: palette.muted }}>
                    {awsHop}
                  </Text>
                ) : null}
                {kind === 'service' && (
                  <Text
                    className="mt-1.5 self-start rounded-xl border px-2.5 py-1 text-xs"
                    style={{ color: palette.text, borderColor: palette.border }}
                  >
                    Service
                  </Text>
                )}
                {kind === 'entry' && (
                  <Text
                    className="mt-1.5 self-start rounded-xl border px-2.5 py-1 text-xs"
                    style={{ color: palette.text, borderColor: palette.border }}
                  >
                    Entry
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};
