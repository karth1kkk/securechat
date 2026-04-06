import React from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider
} from 'react-native-safe-area-context';

/**
 * On web, `NativeSafeAreaProvider` mutates `document.body` (append/removeChild) and can throw
 * `removeChild` errors under React 19 + Strict Mode. Native keeps using `SafeAreaProvider`.
 */
function WebSafeAreaShell({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width, height };

  return (
    <SafeAreaInsetsContext.Provider value={insets}>
      <SafeAreaFrameContext.Provider value={frame}>
        <View className="flex-1" style={{ flex: 1 }}>
          {children}
        </View>
      </SafeAreaFrameContext.Provider>
    </SafeAreaInsetsContext.Provider>
  );
}

export function RootSafeAreaProvider({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    return <WebSafeAreaShell>{children}</WebSafeAreaShell>;
  }
  return (
    <SafeAreaProvider>
      <View className="flex-1" style={{ flex: 1 }}>
        {children}
      </View>
    </SafeAreaProvider>
  );
}
