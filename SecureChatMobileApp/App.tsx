import React, { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ApolloProvider } from '@apollo/client';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { apolloClient } from './graphql/client';
import { ChatListScreen } from './screens/ChatListScreen';
import { ChatScreen } from './screens/ChatScreen';
import { NewChatScreen } from './screens/NewChatScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SecurityCenterScreen } from './screens/SecurityCenterScreen';
import { sessionService } from './services/sessionService';
import { pinService } from './services/pinService';
import { PinLock } from './components/PinLock';
import { RootStackParamList } from './navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [sessionReady, setSessionReady] = useState(false);
  const [locked, setLocked] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await sessionService.ensureSession();
        setSessionReady(true);
        const storedPin = await pinService.getPin();
        setHasPin(!!storedPin);
        setLocked(true);
      } catch (error) {
        console.error('Secure session init failed', error);
        setSessionError('Could not initialise the secure session. Restart the app to try again.');
      }
    })();
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
  }
,
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0b0b0d',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 12
  }
});
