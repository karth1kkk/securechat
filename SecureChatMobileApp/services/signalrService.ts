import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { EncryptedMessage } from './encryptionService';
import { SIGNALR_URL } from '../config';

export class SignalRService {
  private connection: HubConnection | null = null;

  async start(token?: string) {
    if (this.connection) {
      return;
    }

    this.connection = new HubConnectionBuilder()
      .withUrl(SIGNALR_URL, {
        accessTokenFactory: () => token ?? ''
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    await this.connection.start();
  }

  async joinConversation(conversationId: string) {
    if (!this.connection) {
      throw new Error('SignalR connection is not ready.');
    }

    await this.connection.invoke('JoinConversation', conversationId);
  }

  onEncryptedMessage(callback: (message: EncryptedMessage) => void) {
    this.connection?.on('ReceiveEncryptedMessage', callback);
  }

  async stop() {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }
}
