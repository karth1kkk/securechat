import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEYCHAIN_SERVICE = 'securechat.mobile';

type SecureStoreModule = typeof import('expo-secure-store');

let secureStoreAvailable: boolean | null = null;
let secureStoreModule: SecureStoreModule | null | undefined;

const loadSecureStoreModule = async () => {
  if (Platform.OS === 'web') {
    return null;
  }
  if (secureStoreModule !== undefined) {
    return secureStoreModule;
  }

  try {
    secureStoreModule = await import('expo-secure-store');
  } catch (error) {
    console.warn('expo-secure-store could not be loaded.', error);
    secureStoreModule = null;
  }

  return secureStoreModule;
};

const detectSecureStore = async () => {
  if (secureStoreAvailable !== null) {
    return secureStoreAvailable;
  }

  const module = await loadSecureStoreModule();
  if (!module) {
    secureStoreAvailable = false;
    return secureStoreAvailable;
  }

  try {
    secureStoreAvailable = await module.isAvailableAsync();
  } catch (error) {
    console.warn('SecureStore availability check failed, falling back to AsyncStorage.', error);
    secureStoreAvailable = false;
  }

  return secureStoreAvailable;
};

const ensureSecureValue = async (
  key: string,
  secureAction: (module: SecureStoreModule) => Promise<string | null>
) => {
  if (await detectSecureStore()) {
    const module = await loadSecureStoreModule();
    if (module) {
      try {
        return await secureAction(module);
      } catch (error) {
        console.warn('SecureStore operation failed, falling back to AsyncStorage.', error);
        secureStoreAvailable = false;
      }
    }
  }
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.warn('AsyncStorage operation failed.', error);
    return null;
  }
};

const ensureSecureWrite = async (
  key: string,
  value: string,
  secureAction: (module: SecureStoreModule) => Promise<void>
) => {
  if (await detectSecureStore()) {
    const module = await loadSecureStoreModule();
    if (module) {
      try {
        await secureAction(module);
        return;
      } catch (error) {
        console.warn('SecureStore write failed, falling back to AsyncStorage.', error);
        secureStoreAvailable = false;
      }
    }
  }
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.warn('AsyncStorage write failed.', error);
  }
};

const ensureSecureDelete = async (key: string, secureAction: (module: SecureStoreModule) => Promise<void>) => {
  if (await detectSecureStore()) {
    const module = await loadSecureStoreModule();
    if (module) {
      try {
        await secureAction(module);
        return;
      } catch (error) {
        console.warn('SecureStore delete failed, falling back to AsyncStorage.', error);
        secureStoreAvailable = false;
      }
    }
  }
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.warn('AsyncStorage delete failed.', error);
  }
};

export const secureStore = {
  async getItem(key: string) {
    return ensureSecureValue(key, (module) => module.getItemAsync(key, { keychainService: KEYCHAIN_SERVICE }));
  },
  async setItem(key: string, value: string) {
    return ensureSecureWrite(key, value, (module) =>
      module.setItemAsync(key, value, { keychainService: KEYCHAIN_SERVICE })
    );
  },
  async deleteItem(key: string) {
    return ensureSecureDelete(key, (module) =>
      module.deleteItemAsync(key, { keychainService: KEYCHAIN_SERVICE })
    );
  }
};
