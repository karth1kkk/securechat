import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'securechat-thread-cache-v1:';

export type PersistedThreadMessage = {
  id: string;
  content: string;
  isOutgoing: boolean;
  createdAt: string;
  status?: 'sending' | 'sent';
};

export const threadCachePersistence = {
  async get(conversationId: string): Promise<PersistedThreadMessage[] | null> {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + conversationId);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as PersistedThreadMessage[]) : null;
    } catch {
      return null;
    }
  },

  async set(conversationId: string, messages: PersistedThreadMessage[]): Promise<void> {
    // Keep a generous window so local cache does not drop rows the server still has (expiry is server-only).
    const capped = messages.slice(-2000);
    try {
      await AsyncStorage.setItem(PREFIX + conversationId, JSON.stringify(capped));
    } catch (error) {
      console.warn('threadCachePersistence.set failed', error);
    }
  },

  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const ours = keys.filter((k) => k.startsWith(PREFIX));
      if (ours.length > 0) {
        await AsyncStorage.multiRemove(ours);
      }
    } catch (error) {
      console.warn('threadCachePersistence.clearAll failed', error);
    }
  }
};
