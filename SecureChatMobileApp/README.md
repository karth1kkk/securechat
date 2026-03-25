# SecureChatMobileApp

This Expo + React Native shell mirrors the privacy-first SecureChat backend. It focuses on session-based identity, encrypted messaging, SignalR delivery, and a minimal dark UI.

## Features
- Anonymous session/key generation stored in `SecureStore`.
- GraphQL + Apollo client pointing at the backend (`/graphql`).
- SignalR (via `@microsoft/signalr`) to receive real-time encrypted payloads.
- Pin-based app lock with SecureStore persistence and a lean security center.
- Messaging UI that encrypts a payload with AES-GCM, wraps the key with the recipient's public RSA key, and optionally signs the ciphertext.

## Local Setup
1. `cd SecureChatMobileApp`
2. `npm install` (you might need to rerun if Expo CLI previously failed to download). If the install still fails, ensure your network allows access to `https://registry.npmjs.org`.
3. Ensure `.env` uses `GRAPHQL_URL=http://localhost:5002/graphql` and `API_URL=http://localhost:5002` when talking to the backend; this is already the default.
4. `npx expo start` to launch the development server (Metro listens on 8081).

## Notes
- The app assumes the backend exposes the GraphQL mutations/queries defined in `graphql/mutations.ts` and `graphql/queries.ts`.
- `encryptionService` matches the backend by encoding public keys as base64 SPKI and private keys as base64 PKCS#8 to share RSA material safely.
- SignalR is used only for receiving `ReceiveEncryptedMessage` events; outgoing messages still flow through GraphQL but immediately broadcast back via a hub.
- Adjust the connection URI in `graphql/client.ts` and `services/signalrService.ts` when deploying against a production endpoint.
