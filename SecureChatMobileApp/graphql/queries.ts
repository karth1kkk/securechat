import { gql } from '@apollo/client';

export const GET_USER_BY_SESSION_ID = gql`
  query GetUserBySessionId($sessionId: String!) {
    getUserBySessionIdAsync(sessionId: $sessionId) {
      id
      sessionId
      publicKey
      createdAt
    }
  }
`;

export const GET_MESSAGES = gql`
  query GetMessages($conversationId: ID!, $limit: Int, $since: DateTime) {
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
