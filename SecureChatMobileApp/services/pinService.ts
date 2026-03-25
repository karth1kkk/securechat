import { secureStore } from './secureStore';

const PIN_KEY = 'securechat-pin';

export const pinService = {
  async getPin() {
    return secureStore.getItem(PIN_KEY);
  },
  async setPin(pin: string) {
    return secureStore.setItem(PIN_KEY, pin);
  },
  async clearPin() {
    return secureStore.deleteItem(PIN_KEY);
  },
  async verifyPin(candidate: string) {
    const stored = await this.getPin();
    return stored === candidate;
  }
};
