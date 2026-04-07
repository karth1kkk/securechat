import { secureStore } from './secureStore';

const STORAGE_KEY = 'securechat-sent-plaintext-v1';
const MAX_ENTRIES = 2000;

type PlaintextMap = Record<string, string>;

const loadMap = async (): Promise<PlaintextMap> => {
  const raw = await secureStore.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as PlaintextMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const saveMap = async (map: PlaintextMap) => {
  const keys = Object.keys(map);
  if (keys.length > MAX_ENTRIES) {
    const drop = keys.length - MAX_ENTRIES;
    keys.slice(0, drop).forEach((k) => {
      delete map[k];
    });
  }
  await secureStore.setItem(STORAGE_KEY, JSON.stringify(map));
};

export const sentMessagePlaintextService = {
  async get(messageId: string): Promise<string | undefined> {
    const map = await loadMap();
    return map[messageId];
  },

  async set(messageId: string, plaintext: string): Promise<void> {
    const map = await loadMap();
    map[messageId] = plaintext;
    await saveMap(map);
  },

  async clear(): Promise<void> {
    await secureStore.deleteItem(STORAGE_KEY);
  }
};
