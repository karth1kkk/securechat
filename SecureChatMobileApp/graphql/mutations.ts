import { gql } from '@apollo/client';

export const REGISTER_ANONYMOUS = gql`
  mutation RegisterAnonymous($input: RegisterUserInput!) {
    registerAnonymousAsync(input: $input) {
      userId
      sessionId
      publicKey
      token
    }
  }
`;

export const CREATE_CONVERSATION = gql`
  mutation CreateConversation($input: CreateConversationInput!) {
    createConversationAsync(input: $input) {
      id
      isGroup
      createdAt
      participants {
        userId
        publicKey
      }
    }
  }
`;

export const SEND_MESSAGE = gql`
  mutation SendMessage($input: SendMessageInput!) {
    sendMessageAsync(input: $input) {
      id
      conversationId
      senderId
      encryptedContent
      encryptedKey
      nonce
      tag
      signature
      createdAt
      expiryTime
    }
  }
`;
