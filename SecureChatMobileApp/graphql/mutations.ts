import { gql } from '@apollo/client';

export const REGISTER_ANONYMOUS = gql`
  mutation RegisterAnonymous($input: RegisterUserInput!) {
    registerAnonymous(input: $input) {
      userId
      sessionId
      publicKey
      token
    }
  }
`;

export const CREATE_CONVERSATION = gql`
  mutation CreateConversation($input: CreateConversationInput!) {
    createConversation(input: $input) {
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
    sendMessage(input: $input) {
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
