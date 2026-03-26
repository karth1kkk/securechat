import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ApolloProvider } from '@apollo/client';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { apolloClient } from './graphql/client';
import { ChatListScreen } from './screens/ChatListScreen';
import { ChatScreen } from './screens/ChatScreen';
import { NewChatScreen } from './screens/NewChatScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SecurityCenterScreen } from './screens/SecurityCenterScreen';
import { sessionService, SessionRecord } from './services/sessionService';
import { pinService } from './services/pinService';
import { PinLock } from './components/PinLock';
import { RootStackParamList } from './navigation/types';
import { REGISTER_ANONYMOUS } from './graphql/mutations';
import { GRAPHQL_URL } from './config';
import { ApolloError } from '@apollo/client';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [sessionReady, setSessionReady] = useState(false);
  const [locked, setLocked] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const ensureRemoteRegistration = useCallback(async (session: SessionRecord) => {
    // Always register on startup.
    //
    // Why: the backend commonly runs with an in-memory DB during development, so a backend
    // restart forgets all users. The client may still have a stored sessionId/jwtToken and
    // would otherwise skip registration, causing `userBySessionId` lookups to return null.
    //
    // This is safe because the backend `registerAnonymous` is idempotent by publicKey
    // (same publicKey => same user/sessionId).

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
      const baseUrl = GRAPHQL_URL.replace(/\/graphql\/?$/, '');
      const source = error instanceof Error ? error.message : 'Unable to reach the backend.';
      setSessionError(`${source} Ensure ${baseUrl} is running and tap retry.`);
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

  const theme = useMemo(
    () => ({
      ...DarkTheme,
      colors: { ...DarkTheme.colors, background: '#0b0b0d' }
    }),
    []
  );

  if (sessionError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Session unavailable</Text>
        <Text style={styles.errorMessage}>{sessionError}</Text>
        <Pressable style={styles.errorButton} onPress={initializeSession}>
          <Text style={styles.errorButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!sessionReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a9cff" />
        <Text style={styles.loadingText}>Initializing secure session…</Text>
      </View>
    );
  }

  return (
    <ApolloProvider client={apolloClient}>
      <NavigationContainer theme={theme}>
        <StatusBar style="light" />
        <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0b0b0d' }, headerTintColor: '#fff' }}>
          <Stack.Screen name="ChatList" component={ChatListScreen} options={{ title: 'SecureChat' }} />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
          <Stack.Screen name="NewChat" component={NewChatScreen} options={{ title: 'Start Conversation' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="SecurityCenter" component={SecurityCenterScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <PinLock onUnlock={handleUnlock} onCreate={handleCreate} hasPin={hasPin} visible={locked} />
    </ApolloProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#0b0b0d',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  errorTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8
  },
  errorMessage: {
    color: '#f5f5f5',
    textAlign: 'center'
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0b0b0d',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 12
  },
  errorButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: '#1a9cff'
  },
  errorButtonText: {
    color: '#ffffff',
    fontWeight: '600'
  }
});
