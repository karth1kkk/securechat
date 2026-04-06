import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ApolloProvider } from '@apollo/client';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { apolloClient } from './graphql/client';
import { ChatListScreen } from './screens/ChatListScreen';
import { ChatScreen } from './screens/ChatScreen';
import { NewChatScreen } from './screens/NewChatScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SecurityCenterScreen } from './screens/SecurityCenterScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { PathScreen } from './screens/PathScreen';
import { SecureChatNetworkScreen } from './screens/SecureChatNetworkScreen';
import { AppearanceScreen } from './screens/AppearanceScreen';
import { ConversationsSettingsScreen } from './screens/ConversationsSettingsScreen';
import { sessionService, SessionRecord } from './services/sessionService';
import { pinService } from './services/pinService';
import { PinLock } from './components/PinLock';
import { RootStackParamList } from './navigation/types';
import { REGISTER_ANONYMOUS } from './graphql/mutations';
import { ApolloError } from '@apollo/client';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { preferencesService } from './services/preferencesService';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootSafeAreaProvider } from './components/RootSafeAreaProvider';

const Stack = createNativeStackNavigator<RootStackParamList>();

const SecureChatApp: React.FC = () => {
  const [sessionReady, setSessionReady] = useState(false);
  const [locked, setLocked] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [localUsername, setLocalUsername] = useState<string | null>(null);
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
      await ensureRemoteRegistration(session);
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

  useEffect(() => {
    preferencesService.getUsername().then((stored) => setLocalUsername(stored));
  }, []);

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
      <View style={[styles.centered, { backgroundColor: palette.background }]}> 
        <Text style={[styles.errorTitle, { color: palette.text }]}>Session unavailable</Text>
        <Text style={[styles.errorMessage, { color: palette.text }]}>{sessionError}</Text>
        <Pressable style={[styles.errorButton, { backgroundColor: palette.action }]} onPress={initializeSession}>
          <Text style={styles.errorButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!sessionReady) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}> 
        <ActivityIndicator size="large" color={palette.action} />
        <Text style={[styles.loadingText, { color: palette.text }]}>Initializing secure session…</Text>
      </View>
    );
  }

  return (
    <>
      <NavigationContainer theme={navigationTheme}>
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
            options={({ navigation }) => {
              const initial = localUsername?.trim().charAt(0).toUpperCase() ?? 'S';
              return {
                title: 'SecureChat',
                headerTitleAlign: 'center',
                headerLeft: () => (
                  <Pressable
                    style={[styles.headerButton, { borderColor: palette.border }]}
                    onPress={() => navigation.navigate('Settings')}
                  >
                    <Text style={[styles.headerButtonText, { color: palette.text }]}>{initial}</Text>
                  </Pressable>
                ),
              };
            }}
          />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Conversation' }} />
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
        </Stack.Navigator>
      </NavigationContainer>
      <PinLock onUnlock={handleUnlock} onCreate={handleCreate} hasPin={hasPin} visible={locked} />
    </>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8
  },
  errorMessage: {
    textAlign: 'center',
    marginHorizontal: 24,
    marginBottom: 16
  },
  errorButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12
  },
  errorButtonText: {
    color: '#ffffff',
    fontWeight: '600'
  },
  loadingText: {
    marginTop: 12
  }
  ,
  headerButton: {
    marginHorizontal: 14,
    width: 38,
    height: 38,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerButtonText: {
    fontWeight: '700'
  }
});
