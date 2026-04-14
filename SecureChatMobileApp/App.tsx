import './global.css';
import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ApolloProvider } from '@apollo/client';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { apolloClient } from './graphql/client';
import { ChatListScreen } from './screens/ChatListScreen';
import { ChatScreen } from './screens/ChatScreen';
import { NewChatScreen } from './screens/NewChatScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SecurityCenterScreen } from './screens/SecurityCenterScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { PathScreen } from './screens/PathScreen';
import { SecureChatNetworkScreen } from './screens/SecureChatNetworkScreen';
import { CallScreen } from './screens/CallScreen';
import { DonateScreen } from './screens/DonateScreen';
import { AppearanceScreen } from './screens/AppearanceScreen';
import { ConversationsSettingsScreen } from './screens/ConversationsSettingsScreen';
import { MessageRequestsScreen } from './screens/MessageRequestsScreen';
import { RecoveryPasswordScreen } from './screens/RecoveryPasswordScreen';
import { HelpScreen } from './screens/HelpScreen';
import { ClearDataScreen } from './screens/ClearDataScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { sessionService, SessionRecord } from './services/sessionService';
import { navigationRef } from './navigation/navigationRef';
import { IncomingCallHandler } from './components/IncomingCallHandler';
import { pinService } from './services/pinService';
import { PinLock } from './components/PinLock';
import { RootStackParamList } from './navigation/types';
import { REGISTER_ANONYMOUS } from './graphql/mutations';
import { ApolloError } from '@apollo/client';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootSafeAreaProvider } from './components/RootSafeAreaProvider';

const rootViewStyle =
  Platform.OS === 'web'
    ? ({ flex: 1, width: '100%', height: '100%', minHeight: '100%' } as const)
    : ({ flex: 1 } as const);

const Stack = createNativeStackNavigator<RootStackParamList>();

const SecureChatApp: React.FC = () => {
  const [sessionReady, setSessionReady] = useState(false);
  const [locked, setLocked] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<SessionRecord | null>(null);
  const { palette, navigationTheme } = useTheme();

  const ensureRemoteRegistration = useCallback(async (session: SessionRecord) => {
    const { data } = await apolloClient.mutate<
      { registerAnonymous: { userId: string; sessionId: string; publicKey: string; token: string } },
      { input: { publicKey: string; deviceName: string } }
    >({
      mutation: REGISTER_ANONYMOUS,
      variables: {
        input: {
          publicKey: session.publicKey,
          deviceName: session.deviceName
        }
      }
    });

    const result = data?.registerAnonymous;
    if (!result) {
      throw new Error('Unable to register session with SecureChat.');
    }

    const updatedSession: SessionRecord = {
      ...session,
      sessionId: result.sessionId,
      publicKey: result.publicKey,
      userId: result.userId,
      jwtToken: result.token
    };

    await sessionService.updateSession(updatedSession);
    return updatedSession;
  }, []);

  const initializeSession = useCallback(async () => {
    setSessionError(null);
    setSessionReady(false);
    try {
      const session = await sessionService.ensureSession();
      const registered = await ensureRemoteRegistration(session);
      setActiveSession(registered);
      setSessionReady(true);
      const storedPin = await pinService.getPin();
      setHasPin(!!storedPin);
      setLocked(true);
    } catch (error) {
      if (error instanceof ApolloError) {
        console.error('Apollo graphQLErrors', JSON.stringify(error.graphQLErrors, null, 2));
        console.error('Apollo networkError', error.networkError);
      }
      console.error('Secure session init failed', error);
      const source = error instanceof Error ? error.message : 'Unable to reach the backend.';
      setSessionError(`${source} Ensure the backend is running and tap retry.`);
    }
  }, [ensureRemoteRegistration]);

  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  const handleUnlock = async (pin: string) => {
    const verified = await pinService.verifyPin(pin);
    if (verified) {
      setLocked(false);
    }
  };

  const handleCreate = async (pin: string) => {
    await pinService.setPin(pin);
    setHasPin(true);
    setLocked(false);
  };

  if (sessionError) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={[rootViewStyle, { backgroundColor: palette.background }]}>
        <Text className="mb-2 text-center text-xl font-semibold" style={{ color: palette.text }}>
          Session unavailable
        </Text>
        <Text className="mb-4 text-center" style={{ color: palette.text }}>
          {sessionError}
        </Text>
        <Pressable
          className="rounded-xl px-8 py-3"
          style={{ backgroundColor: palette.action }}
          onPress={initializeSession}
        >
          <Text className="font-semibold text-white">Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!sessionReady) {
    return (
      <View className="flex-1 items-center justify-center" style={[rootViewStyle, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.action} />
        <Text className="mt-3" style={{ color: palette.text }}>
          Initializing secure session…
        </Text>
      </View>
    );
  }

  return (
    <View style={rootViewStyle}>
      <View style={{ flex: 1 }}>
        <NavigationContainer ref={navigationRef} theme={navigationTheme}>
          <StatusBar style={palette.statusBarStyle} />
          <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: palette.header },
            headerTintColor: palette.text,
            headerTitleAlign: 'center'
          }}
        >
          <Stack.Screen
            name="ChatList"
            component={ChatListScreen}
            options={{
              title: 'SecureChat',
              headerTitleAlign: 'center'
            }}
          />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Conversation' }} />
          <Stack.Screen name="Call" component={CallScreen} options={{ title: 'Call' }} />
          <Stack.Screen name="Donate" component={DonateScreen} options={{ title: 'Donate' }} />
          <Stack.Screen name="NewChat" component={NewChatScreen} options={{ title: 'Start Conversation' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="SecurityCenter" component={SecurityCenterScreen} />
          <Stack.Screen name="Path" component={PathScreen} options={{ title: 'Path' }} />
          <Stack.Screen
            name="SecureChatNetwork"
            component={SecureChatNetworkScreen}
            options={{ title: 'SecureChat Network' }}
          />
          <Stack.Screen name="Appearance" component={AppearanceScreen} options={{ title: 'Appearance' }} />
          <Stack.Screen
            name="ConversationsSettings"
            component={ConversationsSettingsScreen}
            options={{ title: 'Conversations' }}
          />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
          <Stack.Screen name="MessageRequests" component={MessageRequestsScreen} options={{ title: 'Message Requests' }} />
          <Stack.Screen
            name="RecoveryPassword"
            component={RecoveryPasswordScreen}
            options={{ title: 'Recovery & session' }}
          />
          <Stack.Screen name="Help" component={HelpScreen} options={{ title: 'Help' }} />
          <Stack.Screen name="ClearData" component={ClearDataScreen} options={{ title: 'Clear data' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
          </Stack.Navigator>
          <IncomingCallHandler
            jwtToken={activeSession?.jwtToken ?? null}
            selfUserId={activeSession?.userId ?? null}
            pinLocked={locked}
          />
        </NavigationContainer>
      </View>
      <PinLock onUnlock={handleUnlock} onCreate={handleCreate} hasPin={hasPin} visible={locked} />
    </View>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={rootViewStyle} className="flex-1">
      <RootSafeAreaProvider>
        <ApolloProvider client={apolloClient}>
          <ThemeProvider>
            <SecureChatApp />
          </ThemeProvider>
        </ApolloProvider>
      </RootSafeAreaProvider>
    </GestureHandlerRootView>
  );
}
