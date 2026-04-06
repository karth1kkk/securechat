import { gql } from '@apollo/client';

export const SECURE_CHAT_NETWORK_INFO = gql`
  query SecureChatNetworkInfo {
    secureChatNetworkInfo {
      apiRegion
      environment
      deploymentId
      version
      nodes {
        role
        label
        countryCode
        region
      }
    }
  }
`;

export const GET_USER_BY_SESSION_ID = gql`
  query GetUserBySessionId($sessionId: String!) {
    userBySessionId(sessionId: $sessionId) {
      id
      sessionId
      publicKey
      createdAt
      username
    }
  }
`;

export const GET_MESSAGES = gql`
  query GetMessages($conversationId: UUID!, $limit: Int, $since: DateTime) {
    getMessagesAsync(conversationId: $conversationId, limit: $limit, since: $since) {
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

export const MY_CONVERSATIONS = gql`
  query MyConversationsAsync {
    myConversationsAsync {
      id
      isGroup
      createdAt
      lastMessageAt
      participants {
        userId
        publicKey
        sessionId
        username
      }
    }
  }
`;

export const MY_CONVERSATION_REQUESTS = gql`
  query MyConversationRequestsAsync {
    myConversationRequestsAsync {
      id
      isGroup
      createdAt
      lastMessageAt
      participants {
        userId
        publicKey
        sessionId
        username
      }
    }
  }
`;

export const CONVERSATION_BY_ID = gql`
  query ConversationById($conversationId: UUID!) {
    conversationById(conversationId: $conversationId) {
      id
      lastMessageAt
      participants {
        userId
        publicKey
        sessionId
        username
      }
    }
  }
`;
