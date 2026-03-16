# SecureChat Mobile Backend

SecureChat Mobile is a cybersecurity-focused messaging backend that combines GraphQL, JWT authentication, and SignalR for secure, real-time conversations. The API is built with ASP.NET Core 8 and Entity Framework Core talking to PostgreSQL, so it runs great locally and can be deployed to any cloud provider that can host .NET services.

## Highlights

- **Authentication:** Register/login mutations issue JWT access and refresh tokens and record device sessions so each login can be audited.
- **Messaging:** `SendMessage` encrypts content with `IAesEncryptionService` before persisting it and pushing it over the `ChatHub`.
- **Security alerts:** New-device, new-IP, and suspicious-activity events are stored in the database and surfaced by GraphQL queries for the mobile client.
- **SignalR:** The `/hubs/chat` endpoint wires each connection into conversation groups so clients can receive `ReceiveMessage` events in real time.

## Solution layout

- `SecureChat.Domain` – core entities (users, messages, device sessions, security alerts).  
- `SecureChat.Infrastructure` – EF Core `SecureChatDbContext`, migrations, and persistence helpers.  
- `SecureChat.Application` – GraphQL types, DTOs, and support services (encryption, security helpers).  
- `SecureChat.Api` – ASP.NET Core host with JWT authentication, GraphQL server, SignalR hub, and middleware.

## Getting started

1. Install the .NET 8 SDK and PostgreSQL (or run a Dockerized Postgres instance).
2. Create the database, e.g. `securechat_db`, and edit `SecureChat.Api/appsettings.Development.json` or `appsettings.json` to match your credentials.
3. From the solution root, run the migrations:

   ```bash
   dotnet ef migrations add InitialCreate -p SecureChat.Infrastructure -s SecureChat.Api
   dotnet ef database update -p SecureChat.Infrastructure -s SecureChat.Api
   ```

4. Launch the backend:

   ```bash
   /usr/local/share/dotnet/dotnet run --project SecureChat.Api
   ```

5. The GraphQL playground at `http://localhost:5002/graphql` lets you explore queries/mutations; the mobile client should connect to `http://192.168.0.106:5002/graphql` (see `SecureChatMobileApp/src/config.ts`), and SignalR embraces `/hubs/chat`.

## GraphQL surface

- **Queries** (`GetUsers`, `GetConversations`, `GetMessages`, `GetSecurityAlerts`, `GetDeviceSessions`) are all paged, filtered, and sorted using HotChocolate’s helpers.  
- **Mutations** (`RegisterUser`, `LoginUser`, `SendMessage`, `CreateConversation`, `ResolveSecurityAlert`, `RefreshToken`, `LogoutFromAllDevices`) drive the auth flow, message creation, and alert resolution.  
- **Security**: The mutation arguments that need services are marked with `[Service]` so HotChocolate injects the EF context, config, SignalR hub, and encryption helpers rather than treating them as schema inputs.

## SignalR

Clients authenticate with the JWT and then join conversation groups via `ChatHub`. The hub simply exposes `JoinConversation` and the server pushes `ReceiveMessage` events after a message is persisted so subscribers stay in sync.

## Deployment tips

- Keep the JWT key/issuer/audience in environment variables on your cloud host instead of committing them.  
- Point `SecureChat.Api/appsettings.json` at your cloud PostgreSQL (or MariaDB if you swap providers later).  
- Ensure your hosting platform allows port 5002 (or whatever you configure via `ASPNETCORE_URLS`), and keep SignalR traffic tunneled through `/hubs/chat`.

## License

For university project use.
