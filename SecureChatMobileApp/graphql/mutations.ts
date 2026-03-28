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
      lastMessageAt
      participants {
        userId
        sessionId
        username
      }
    }
  }
`;

export const CREATE_CONVERSATION_REQUEST = gql`
  mutation CreateConversationRequest($input: CreateConversationRequestInput!) {
    createConversationRequest(input: $input) {
      id
    }
  }
`;

export const ACCEPT_CONVERSATION_REQUEST = gql`
  mutation AcceptConversationRequest($input: AcceptConversationRequestInput!) {
    acceptConversationRequest(input: $input) {
      id
    }
  }
`;

export const DECLINE_CONVERSATION_REQUEST = gql`
  mutation DeclineConversationRequest($input: DeclineConversationRequestInput!) {
    declineConversationRequest(input: $input)
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

export const CREATE_CONVERSATION_WITH_SESSION_ID = gql`
  mutation CreateConversationWithSessionId($input: CreateConversationWithSessionIdInput!) {
    createConversationWithSessionId(input: $input) {
      id
      participants {
        userId
        sessionId
        username
      }
      lastMessageAt
    }
  }
`;

export const DELETE_CONVERSATION = gql`
  mutation DeleteConversation($input: DeleteConversationInput!) {
    deleteConversation(input: $input)
  }
`;

export const UPDATE_USERNAME = gql`
  mutation UpdateUsername($input: UpdateUsernameInput!) {
    updateUsername(input: $input)
  }
`;
