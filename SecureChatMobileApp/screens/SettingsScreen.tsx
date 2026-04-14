import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Image, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { preferencesService } from '../services/preferencesService';
import { sessionService } from '../services/sessionService';
import { useTheme } from '../theme/ThemeContext';
import * as Clipboard from 'expo-clipboard';
import { ProfileEditSheet } from '../components/ProfileEditSheet';
import { SessionQrSheet } from '../components/SessionQrSheet';
import { Ionicons } from '@expo/vector-icons';

type MenuItem = {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  destructive?: boolean;
};

export const SettingsScreen: React.FC<NativeStackScreenProps<RootStackParamList, 'Settings'>> = ({ navigation }) => {
  const { palette } = useTheme();
  const [username, setUsername] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);

  const refreshProfile = useCallback(() => {
    void preferencesService.getUsername().then(setUsername);
    void preferencesService.getProfilePhotoUri().then(setProfilePhotoUri);
    void sessionService.getSession().then((session) => setSessionId(session?.sessionId ?? null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshProfile();
    }, [refreshProfile])
  );

  const initials = useMemo(() => {
    const source = username ?? sessionId ?? 'SecureChat';
    const tokens = source.split(' ').filter(Boolean);
    if (tokens.length === 0) {
      return 'SC';
    }
    if (tokens.length === 1) {
      return tokens[0].slice(0, 2).toUpperCase();
    }
    return (tokens[0][0] + tokens[1][0]).toUpperCase();
  }, [username, sessionId]);

  const handleShareId = async () => {
    const message = sessionId ? `SecureChat Session ID: ${sessionId}` : 'SecureChat session credentials';
    try {
      await Share.share({ message });
    } catch (error) {
      console.error('Share cancelled', error);
    }
  };

  const handleCopyId = async () => {
    if (!sessionId) {
      return;
    }
    await Clipboard.setStringAsync(sessionId);
    setFeedback('Copied!');
    setTimeout(() => setFeedback(null), 1400);
  };

  const menuSections: MenuItem[][] = [
    [
      {
        label: 'Donate',
        icon: 'heart',
        onPress: () => navigation.navigate('Donate')
      },
      {
        label: 'Games',
        icon: 'grid',
        onPress: () => navigation.navigate('Games')
      },
      {
        label: 'Invite a Friend',
        icon: 'user-plus',
        onPress: handleShareId
      }
    ],
    [
      {
        label: 'Path',
        icon: 'map',
        onPress: () => navigation.navigate('Path')
      },
      {
        label: 'SecureChat Network',
        icon: 'cloud',
        onPress: () => navigation.navigate('SecureChatNetwork')
      }
    ],
    [
      {
        label: 'Privacy',
        icon: 'shield',
        onPress: () => navigation.navigate('SecurityCenter')
      },
      {
        label: 'Notifications',
        icon: 'bell',
        onPress: () => navigation.navigate('Notifications')
      }
    ],
    [
      {
        label: 'Conversations',
        icon: 'message-circle',
        onPress: () => navigation.navigate('ConversationsSettings')
      },
      {
        label: 'Appearance',
        icon: 'moon',
        onPress: () => navigation.navigate('Appearance')
      },
      {
        label: 'Message Requests',
        icon: 'inbox',
        onPress: () => navigation.navigate('MessageRequests')
      }
    ],
    [
      {
        label: 'Recovery Password',
        icon: 'lock',
        onPress: () => navigation.navigate('RecoveryPassword')
      },
      {
        label: 'Help',
        icon: 'info',
        onPress: () => navigation.navigate('Help')
      },
      {
        label: 'Clear Data',
        icon: 'trash-2',
        onPress: () => navigation.navigate('ClearData'),
        destructive: true
      }
    ]
  ];

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View className="mr-2.5 flex-row items-center">
          <Pressable
            onPress={() => setProfileEditOpen(true)}
            className="p-1.5"
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <Feather name="edit" size={20} color={palette.action} />
          </Pressable>
          <Pressable
            onPress={() => setQrOpen(true)}
            className="p-1.5"
            accessibilityRole="button"
            accessibilityLabel="Show or scan Session ID QR code"
          >
            <Ionicons name="qr-code-outline" size={22} color={palette.action} />
          </Pressable>
        </View>
      )
    });
  }, [navigation, palette.action]);

  return (
    <>
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
    >
      <View
        className="mb-5 items-center rounded-[20px] p-5"
        style={{
          backgroundColor: palette.surface,
          shadowColor: palette.shadow,
          shadowOffset: { width: 0, height: 15 },
          shadowOpacity: 0.5,
          shadowRadius: 30,
          elevation: 10
        }}
      >
        <View className="flex-row items-center justify-center">
          <View className="relative">
            <Pressable
              className="h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-full"
              style={{ backgroundColor: palette.card }}
              onPress={() => setProfileEditOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Edit profile photo"
            >
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} className="h-full w-full" resizeMode="cover" />
              ) : (
                <Text className="text-[32px] font-bold" style={{ color: palette.text }}>
                  {initials}
                </Text>
              )}
            </Pressable>
            <View
              className="absolute -bottom-1.5 -right-1.5 h-8 w-8 items-center justify-center rounded-full"
              style={{
                backgroundColor: palette.action,
                shadowColor: palette.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.35,
                shadowRadius: 4,
                elevation: 4
              }}
            >
              <Feather name="camera" size={15} color="#fff" />
            </View>
          </View>
        </View>
        <Text className="mt-4 text-center text-2xl font-bold" style={{ color: palette.text }}>
          {username ?? 'SecureChat User'}
        </Text>
        <Text className="mt-1.5 text-center text-xs" style={{ color: palette.muted }}>
          Your Account ID
        </Text>
        <Text
          className="mt-1 text-center text-sm leading-5"
          style={{ color: palette.text }}
          numberOfLines={2}
          ellipsizeMode="middle"
        >
          {sessionId ?? 'Generating…'}
        </Text>
        <View className="mt-4 flex-row">
          <Pressable
            className="mr-3 flex-1 flex-row items-center justify-center rounded-2xl border p-3"
            style={{ borderColor: palette.border }}
            onPress={handleShareId}
          >
            <Feather name="share" size={16} color={palette.action} />
            <Text className="ml-1.5 font-semibold" style={{ color: palette.action }}>
              Share
            </Text>
          </Pressable>
          <Pressable
            className="flex-1 flex-row items-center justify-center rounded-2xl border p-3"
            style={{ borderColor: palette.border }}
            onPress={handleCopyId}
          >
            <Feather name="copy" size={16} color={palette.action} />
            <Text className="ml-1.5 font-semibold" style={{ color: palette.action }}>
              Copy
            </Text>
          </Pressable>
        </View>
        {feedback ? (
          <Text className="mt-2.5 text-[13px]" style={{ color: palette.action }}>
            {feedback}
          </Text>
        ) : null}
      </View>

      <View className="mb-[30px]">
        {menuSections.map((section, index) => (
          <View key={`section-${index}`} className="mb-4 rounded-[18px] bg-transparent p-3">
            {section.map((item) => (
              <Pressable
                key={item.label}
                className="mb-2 flex-row items-center justify-between rounded-2xl border p-3.5"
                style={({ pressed }) => ({
                  backgroundColor: pressed ? palette.card : palette.surface,
                  borderColor: item.destructive ? '#f87171' : palette.border
                })}
                onPress={item.onPress}
              >
                <View className="flex-row items-center">
                  <Feather
                    name={item.icon}
                    size={18}
                    style={{ marginRight: 12 }}
                    color={item.destructive ? '#f87171' : palette.text}
                  />
                  <Text className="text-base font-semibold" style={{ color: item.destructive ? '#f87171' : palette.text }}>
                    {item.label}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={palette.muted} />
              </Pressable>
            ))}
          </View>
        ))}
      </View>
      <Text className="text-center text-xs" style={{ color: palette.muted }}>
        SecureChat • v{appVersion}
      </Text>
    </ScrollView>
    <ProfileEditSheet
      visible={profileEditOpen}
      onClose={() => setProfileEditOpen(false)}
      onSaved={refreshProfile}
    />
    <SessionQrSheet
      visible={qrOpen}
      onClose={() => setQrOpen(false)}
      sessionId={sessionId}
      navigation={navigation}
    />
    </>
  );
};
