import { getRandomBytesAsync } from 'expo-random';
import { secureStore } from './secureStore';
import { encryptionService } from './encryptionService';

const SESSION_KEY = 'securechat-session';
const SESSION_ID_LENGTH = 66;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export interface SessionRecord {
  sessionId: string;
  publicKey: string;
  privateKey: string;
  createdAt: number;
  deviceName: string;
  jwtToken?: string;
}

const selectChar = (index: number) => ALPHABET[index % ALPHABET.length];

const randomSessionId = async () => {
  const bytes = await getRandomBytesAsync(SESSION_ID_LENGTH);
  return Array.from(bytes)
    .map((byte) => selectChar(byte % ALPHABET.length))
    .join('');
};

export const sessionService = {
  async getSession(): Promise<SessionRecord | null> {
    const serialized = await secureStore.getItem(SESSION_KEY);
    if (!serialized) {
      return null;
    }
    return JSON.parse(serialized) as SessionRecord;
  },

  async ensureSession(): Promise<SessionRecord> {
    const existing = await this.getSession();
    if (existing) {
      return existing;
    }

    const sessionId = await randomSessionId();
    const keys = encryptionService.generateSessionKeys();
    const session: SessionRecord = {
      sessionId,
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      createdAt: Date.now(),
      deviceName: 'Mobile Device'
    };

    await secureStore.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },

  async updateSession(session: SessionRecord) {
    await secureStore.setItem(SESSION_KEY, JSON.stringify(session));
  },

  async attachToken(token: string) {
    const session = (await this.getSession()) ?? (await this.ensureSession());
    session.jwtToken = token;
    await this.updateSession(session);
  }
};
