import { getRandomBytesAsync } from 'expo-random';
import forge from 'node-forge';
import { secureStore } from './secureStore';

const LEGACY_RECOVERY_CODE_KEY = 'securechat-pin-recovery-code';
const RECOVERY_CODE_HASH_KEY = 'securechat-pin-recovery-code-hash';
const CODE_LENGTH = 16;
const ALPHABET = '0123456789';

const selectChar = (index: number) => ALPHABET[index % ALPHABET.length];

async function generateRecoveryCode(): Promise<string> {
  const bytes = await getRandomBytesAsync(CODE_LENGTH);
  return Array.from(bytes)
    .map((byte) => selectChar(byte))
    .join('');
}

function hashRecoveryCode(code: string): string {
  const md = forge.md.sha256.create();
  md.update(code, 'utf8');
  return md.digest().toHex();
}

export const pinRecoveryService = {
  async migrateLegacyRecoveryCode(): Promise<void> {
    const existingHash = await this.getRecoveryCodeHash();
    if (existingHash) {
      return;
    }

    const legacy = await secureStore.getItem(LEGACY_RECOVERY_CODE_KEY);
    if (!legacy) {
      return;
    }

    const legacyHash = hashRecoveryCode(legacy);
    await secureStore.setItem(RECOVERY_CODE_HASH_KEY, legacyHash);
    await secureStore.deleteItem(LEGACY_RECOVERY_CODE_KEY);
  },

  async getRecoveryCodeHash(): Promise<string | null> {
    return secureStore.getItem(RECOVERY_CODE_HASH_KEY);
  },

  async ensureRecoveryCodeInitialized(): Promise<void> {
    await this.migrateLegacyRecoveryCode();
    const existingHash = await this.getRecoveryCodeHash();
    if (existingHash) {
      return;
    }

    const next = await generateRecoveryCode();
    const nextHash = hashRecoveryCode(next);
    await secureStore.setItem(RECOVERY_CODE_HASH_KEY, nextHash);
  },

  async regenerateRecoveryCode(): Promise<string> {
    const next = await generateRecoveryCode();
    const nextHash = hashRecoveryCode(next);
    await secureStore.setItem(RECOVERY_CODE_HASH_KEY, nextHash);
    return next;
  },

  async verifyRecoveryCode(candidate: string): Promise<boolean> {
    await this.migrateLegacyRecoveryCode();
    const savedHash = await this.getRecoveryCodeHash();
    if (!savedHash) {
      return false;
    }
    const candidateHash = hashRecoveryCode(candidate);
    return savedHash === candidateHash;
  },

  async clearRecoveryCode(): Promise<void> {
    await secureStore.deleteItem(LEGACY_RECOVERY_CODE_KEY);
    await secureStore.deleteItem(RECOVERY_CODE_HASH_KEY);
  }
};
