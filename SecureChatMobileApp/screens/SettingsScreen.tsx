import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { preferencesService, DEFAULT_THEME } from '../services/preferencesService';
import { sessionService } from '../services/sessionService';
import { useTheme } from '../theme/ThemeContext';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileEditSheet } from '../components/ProfileEditSheet';

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

  useFocusEffect(
    useCallback(() => {
      preferencesService.getUsername().then(setUsername);
      sessionService.getSession().then((session) => setSessionId(session?.sessionId ?? null));
    }, [])
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

  const handleClearData = () => {
    Alert.alert('Clear local data', 'This removes your stored session and preferences.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear data',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.clear();
            await preferencesService.setUsername(null);
            await preferencesService.setThemePreference(DEFAULT_THEME);
            await sessionService.clearSession();
            Alert.alert('All data cleared', 'Re-open the app to reinitialize the session.');
          } catch (error) {
            console.error('Clear data failed', error);
            Alert.alert('Unable to clear data', 'Please try again.');
          }
        }
      }
    ]);
  };

  const menuSections: MenuItem[][] = [
    [
      {
        label: 'Donate',
        icon: 'heart',
        onPress: () => Alert.alert('Donate', 'Support development by sharing a tip channel soon.')
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
        onPress: () => Alert.alert('Notifications', 'Manage push and badge settings in a future update.')
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
        onPress: () => Alert.alert('Message Requests', 'This screen will help you review new requests.')
      }
    ],
    [
      {
        label: 'Recovery Password',
        icon: 'lock',
        onPress: () => Alert.alert('Recovery Password', 'Coming soon to keep your session reachable.')
      },
      {
        label: 'Help',
        icon: 'info',
        onPress: () => Alert.alert('Help', 'Documentation and support will land here shortly.')
      },
      {
        label: 'Clear Data',
        icon: 'trash-2',
        onPress: handleClearData,
        destructive: true
      }
    ]
  ];

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => setProfileEditOpen(true)} style={styles.headerIcon}>
          <Feather name="edit" size={20} color={palette.action} />
        </Pressable>
      )
    });
  }, [navigation, palette.action]);

  return (
    <>
    <ScrollView style={[styles.container, { backgroundColor: palette.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.profileCard, { backgroundColor: palette.surface, shadowColor: palette.shadow }]}> 
        <View style={styles.avatarRow}>
          <View style={styles.avatarBorder}> 
            <Pressable style={[styles.avatar, { backgroundColor: palette.card }]} onPress={() => setProfileEditOpen(true)}>
              <Text style={[styles.initials, { color: palette.text }]}>{initials}</Text>
            </Pressable>
            <Pressable style={[styles.editBadge, { backgroundColor: palette.action }]} onPress={() => setProfileEditOpen(true)}>
              <Feather name="edit-3" size={14} color="#fff" />
            </Pressable>
            <View style={[styles.plusBadge, { backgroundColor: palette.surface, shadowColor: palette.shadow }]}> 
              <Feather name="plus" size={12} color={palette.action} />
            </View>
          </View>
        </View>
        <Text style={[styles.username, styles.centeredText, { color: palette.text }]}>{username ?? 'SecureChat User'}</Text>
        <Text style={[styles.subHeading, styles.centeredText, { color: palette.muted }]}>Your Account ID</Text>
        <Text
          style={[styles.sessionId, styles.centeredText, { color: palette.text }]}
          numberOfLines={2}
          ellipsizeMode="middle"
        >
          {sessionId ?? 'Generating…'}
        </Text>
        <View style={styles.buttonRow}>
          <Pressable style={[styles.actionButton, styles.actionButtonLeft, { borderColor: palette.border }]} onPress={handleShareId}>
            <Feather name="share" size={16} color={palette.action} />
            <Text style={[styles.actionLabel, { color: palette.action }]}>Share</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, { borderColor: palette.border }]} onPress={handleCopyId}>
            <Feather name="copy" size={16} color={palette.action} />
            <Text style={[styles.actionLabel, { color: palette.action }]}>Copy</Text>
          </Pressable>
        </View>
        {feedback ? <Text style={[styles.feedback, { color: palette.action }]}>{feedback}</Text> : null}
      </View>
      <View style={styles.sections}> 
        {menuSections.map((section, index) => (
          <View key={`section-${index}`} style={styles.sectionCard}> 
            {section.map((item) => (
              <Pressable
                key={item.label}
                style={({ pressed }) => [
                  styles.menuItem,
                  {
                    backgroundColor: pressed ? palette.card : palette.surface,
                    borderColor: item.destructive ? '#f87171' : palette.border
                  }
                ]}
                onPress={item.onPress}
              >
                <View style={styles.menuRow}> 
                  <Feather
                    name={item.icon}
                    size={18}
                    style={styles.menuIcon}
                    color={item.destructive ? '#f87171' : palette.text}
                  />
                  <Text style={[styles.menuLabel, { color: item.destructive ? '#f87171' : palette.text }]}>{item.label}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={palette.muted} />
              </Pressable>
            ))}
          </View>
        ))}
      </View>
      <Text style={[styles.footer, { color: palette.muted }]}>SecureChat • v{appVersion}</Text>
    </ScrollView>
    <ProfileEditSheet
      visible={profileEditOpen}
      onClose={() => setProfileEditOpen(false)}
      onSaved={() => void preferencesService.getUsername().then(setUsername)}
    />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    padding: 16,
    paddingBottom: 24
  },
  profileCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 10,
    alignItems: 'center'
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarBorder: {
    position: 'relative'
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  initials: {
    fontSize: 32,
    fontWeight: '700'
  },
  editBadge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  plusBadge: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4
  },
  username: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16
  },
  subHeading: {
    fontSize: 12,
    marginTop: 6
  },
  sessionId: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20
  },
  centeredText: {
    textAlign: 'center'
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 16
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  actionButtonLeft: {
    marginRight: 12
  },
  actionLabel: {
    marginLeft: 6,
    fontWeight: '600'
  },
  feedback: {
    marginTop: 10,
    fontSize: 13
  },
  sections: {
    marginBottom: 30
  },
  sectionCard: {
    borderRadius: 18,
    padding: 12,
    marginBottom: 16,
    backgroundColor: 'transparent'
  },
  menuItem: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600'
  },
  menuIcon: {
    marginRight: 12
  },
  footer: {
    fontSize: 12,
    textAlign: 'center'
  },
  headerIcon: {
    padding: 6,
    marginRight: 10
  }
});
