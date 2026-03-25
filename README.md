# SecureChat Platform

This repository now houses both the **SecureChatBackend** (ASP.NET Core 8, GraphQL, SignalR, Postgres, JWT) and the **SecureChatMobileApp** (Expo + React Native) that implements a privacy-first encrypted messaging flow inspired by Session.

## Projects

### SecureChatBackend
- ASP.NET Core 8 clean architecture layers: Entities → Repositories → Services → GraphQL/SignalR.
- Privacy-first principles: session-only identities, no plaintext storage, JWTs based on a 66-character `SessionId`, rate limiting, and SignalR groups keyed by conversation.
- Storage includes encrypted messages with `EncryptedContent`, `EncryptedKey`, AES nonce/tag, and optional signatures so the server never decrypts payloads.
- `Crypto/EncryptionModule` documents how clients can mirror the server-side AES/RSA logic for key rotation and signing.
- Run via `dotnet run` after configuring PostgreSQL connection + JWT secret in `appsettings.json`/environment.

### SecureChatMobileApp
- Expo + TypeScript app with React Navigation, Apollo Client, SecureStore, and SignalR wiring.
- Sessions generate RSA key pairs locally, store them securely, and exchange encrypted payloads with AES-GCM + RSA-OAEP key wrapping.
- PIN-based app lock, minimal chat UI (dark mode), and security center for key rotation.
- GraphQL mutations/queries and `encryptionService` mirror backend expectations; SignalR hook listens to `ReceiveEncryptedMessage` events.
- Run via `npm install` (rerun if the first `expo create` struggled with `ECONNRESET`), update `.env` so `GRAPHQL_URL`/`API_URL` point at `http://localhost:5002`, and then `npx expo start` (Metro runs on 8081).

## Next Steps
1. Configure backend settings (Postgres connection, JWT secret). Apply EF Core migrations.
2. Link mobile app to backend endpoints and confirm GraphQL/SignalR integration.
3. Add automated tests (backend GraphQL + SignalR, mobile flows) and consider distributing keys via QR-onboarding.

## Notes
- Backend now falls back to an in-memory database whenever `DefaultConnection` is unset, so `dotnet run` starts without Postgres in test environments. To target production Postgres, populate `appsettings.json` or environment variables (see `JwtSettings:Secret` and `ConnectionStrings:DefaultConnection`) before running.  
- Mobile clients read `SecureChatMobileApp/.env` for `GRAPHQL_URL`/`API_URL`; update those values to match your deployed backend and rerun `npm install` if dependencies fail.
