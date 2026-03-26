import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { EncryptedMessage } from './encryptionService';
import { SIGNALR_URL } from '../config';

// Shape of the backend SignalR DTO (MessageDto) as serialized to JSON.
// Backend C# properties use PascalCase; JSON is typically camelCased by ASP.NET.
type IncomingMessageDto = {
  id: string;
  senderId: string;
  encryptedContent: string;
  encryptedKey: string;
  nonce: string;
  tag: string;
  signature?: string | null;
  createdAt?: string;
};

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

  onEncryptedMessage(callback: (message: EncryptedMessage & { id: string; senderId: string }) => void) {
    this.connection?.on('ReceiveEncryptedMessage', (dto: IncomingMessageDto) => {
      callback({
        id: dto.id,
        senderId: dto.senderId,
        ciphertext: dto.encryptedContent,
        encryptedKey: dto.encryptedKey,
        nonce: dto.nonce,
        tag: dto.tag,
        signature: dto.signature ?? undefined
      });
    });
  }

  async stop() {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }
}
