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

## SecureChat vs Session

[Session](https://getsession.org) routes messages over the **Loki/Oxen onion network** (entry nodes, service nodes, swarms). **SecureChat** is a **client–server** design: the app talks to this backend over **TLS** (GraphQL + REST-style hub). Messages are still **end-to-end encrypted** on the client; the server stores **ciphertext** only. The **Path** screen shows hops from **server configuration** (`SecureChatNetwork` in appsettings), not a live onion circuit. That keeps the UX similar while matching this architecture.

### Feature parity backlog (Session has more)

- **Path / network UI**: Backend-driven nodes and **SecureChat Network** screen are implemented; tune `SecureChatNetwork` in config for your deployment.
- **Groups**: Backend supports `isGroup`; the mobile app is mostly direct-message oriented—adding a “New group” flow would close the gap.
- **Push notifications**: Not wired; would need device tokens + provider (FCM/APNs) on the backend.
- **Media / voice messages**: Not implemented (larger scope: encrypted attachments and storage).
- **Conversation-wide auto-delete**: [`ConversationsSettingsScreen`](SecureChatMobileApp/screens/ConversationsSettingsScreen.tsx) is still a placeholder; per-message expiry exists in chat.
- **Communities / open groups**: Not in this backend; Session-specific for many use cases.

---

## Hosting the backend on AWS

This section describes a **production-style** deployment: **RDS PostgreSQL**, **secrets**, **HTTPS**, and **ECS Fargate** with a container built from [`SecureChatBackend/Dockerfile`](SecureChatBackend/Dockerfile). **Elastic Beanstalk** is noted as a simpler alternative.

### 1. PostgreSQL on RDS

1. In the AWS console, open **RDS** → **Create database**.
2. Choose **PostgreSQL**, a recent version compatible with Npgsql (e.g. 15+), and a **DB instance class** suited to your load (e.g. `db.t4g.micro` to start).
3. Set a strong **master password** and store it in **Secrets Manager** (or note it only for initial bootstrap).
4. Under **Connectivity**, place the instance in the same **VPC** you will use for the app tier. Create a **security group** that allows **inbound TCP 5432** only from the security group attached to your ECS tasks or EB instances (not from `0.0.0.0/0`).
5. After creation, copy the **endpoint** host name. Build the connection string in the form used by [`appsettings.json`](SecureChatBackend/appsettings.json):  
   `Host=<endpoint>;Port=5432;Database=securechat_db;Username=<user>;Password=<password>;SSL Mode=Require`  
   (adjust SSL mode to match your RDS TLS settings.)

6. Run **EF Core migrations** against RDS from a developer machine or CI (with network access to RDS), or apply migrations as part of a release job.

### 2. Secrets and environment variables

Store sensitive values in **AWS Secrets Manager** or **SSM Parameter Store**, and inject them into the container or EB environment as **environment variables** (ECS task definition, EB environment properties, or Lambda-less alternatives).

**Checklist (names use the double-underscore form for nested configuration in .NET):**

- `ASPNETCORE_ENVIRONMENT` — set to `Production`.
- `ASPNETCORE_URLS` — for the provided Dockerfile, the image defaults to `http://+:8080`; the load balancer targets that port.
- `ConnectionStrings__DefaultConnection` — full PostgreSQL connection string for RDS.
- `JwtSettings__Secret` — long random secret (HS256); must be stable across deploys so existing JWTs remain valid until they expire.
- `JwtSettings__Issuer` and `JwtSettings__Audience` — match what you use in production (defaults exist in appsettings).
- `Database__UseInMemory` — set to `false` in production so the app uses Postgres.
- `Cors__AllowedOrigins__0`, `Cors__AllowedOrigins__1`, … — origins allowed to call GraphQL and SignalR with credentials (e.g. your Expo web origin, or the HTTPS origin of a hosted dev client). Add every origin the mobile or web app uses.
- `SecureChatNetwork__ApiRegion` — optional; otherwise **`AWS_REGION`** is read at runtime for display on the **SecureChat Network** screen.
- `SecureChatNetwork__DeploymentId` — optional; otherwise **`SECURECHAT_DEPLOYMENT_LABEL`** can be set (e.g. ECS service name).
- Optional JSON for path hops: override `SecureChatNetwork__Nodes` via environment or a mounted `appsettings.Production.json` if you prefer not to bake config into the image.

### 3. Container image (ECS Fargate + ECR + ALB)

**Recommended path for containers:**

1. **Build the image** from the backend project folder:  
   `cd SecureChatBackend && docker build -t securechat-api .`
2. **Create an ECR repository**, authenticate Docker to ECR, **tag** and **push** the image.
3. **Create an ECS cluster** (Fargate). Define a **task definition**: container port **8080**, CPU/memory as needed, environment variables from the checklist above (or secrets from Secrets Manager).
4. **Create an Application Load Balancer** with a **target group** pointing to the ECS service on port **8080**. Use **HTTP** from ALB to the task (TLS terminates at the ALB).
5. **ACM**: Request a certificate for your API hostname in the same region (or use CloudFront with a certificate in `us-east-1` if you front with CloudFront).
6. **Listener**: HTTPS (443) → target group; optional HTTP → redirect to HTTPS.
7. **Health check**: Point the target group to **`GET /health`** on the service (returns plain `ok`, HTTP 200). The GraphQL field **`health`** is also available for deeper checks from clients.

**SignalR**: Sticky sessions are not required for all setups, but **WebSockets** must be **enabled on the ALB** for `/hubs/messaging`. Ensure the listener rules allow **upgrade** headers and long-lived connections.

### 4. Simpler alternative: Elastic Beanstalk (.NET on Linux)

1. Create an **Elastic Beanstalk** environment with the **.NET on Linux** platform (or **Docker** platform and reuse the same image).
2. Set the same **environment properties** as in the checklist (connection string, JWT, CORS, etc.).
3. Attach **RDS** to the environment or use a standalone RDS instance with security groups allowing the EB instances.
4. Put **ACM** on the environment load balancer for HTTPS.

### 5. Mobile and web clients after deploy

1. Note the public **HTTPS base URL** of the API (e.g. `https://api.example.com`).
2. In `SecureChatMobileApp/.env`, set **`GRAPHQL_URL`** to `https://api.example.com/graphql` and **`API_URL`** to `https://api.example.com` (no trailing slash). `config.ts` builds the SignalR URL from `API_URL`.
3. Rebuild or restart Expo so environment variables are picked up.
4. For **iOS ATS** and **Android cleartext**, use **HTTPS** in production; plain `http://` is only for local development.

### 6. Optional hardening

- **WAF** in front of ALB for rate-based rules.
- **CloudFront** in front of ALB for static edge caching (less critical for GraphQL/SignalR than for static assets).
- **Private subnets** for ECS tasks with only ALB in public subnets.
- **Rotate JWT signing keys** with a planned cutover (not implemented in this repo by default).
