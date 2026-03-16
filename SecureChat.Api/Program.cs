using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HotChocolate;
using HotChocolate.AspNetCore;
using HotChocolate.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SecureChat.Application.GraphQL;
using SecureChat.Api.Middleware;
using SecureChat.Application.Security;
using SecureChat.Domain.Entities;
using SecureChat.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);
var urls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS") ?? "http://0.0.0.0:5002";
builder.WebHost.UseUrls(urls);

builder.Services.AddDbContext<SecureChatDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var jwtSection = builder.Configuration.GetSection("Jwt");

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSection["Issuer"],
            ValidAudience = jwtSection["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSection["Key"]!))
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddHttpContextAccessor();

builder.Services.AddScoped<IAesEncryptionService, AesEncryptionService>();

builder.Services
    .AddGraphQLServer()
    .AddQueryType<Query>()
    .AddMutationType<Mutation>()
    .AddType<UserType>()
    .AddType<ConversationType>()
    .AddType<MessageType>()
    .AddType<SecurityAlertType>()
    .AddProjections()
    .AddFiltering()
    .AddSorting();

builder.Services.AddSignalR();

builder.Services.AddScoped<LoginActivityMiddleware>();

var app = builder.Build();

app.UseRouting();
app.UseMiddleware<LoginActivityMiddleware>();
app.UseAuthentication();
app.UseAuthorization();

app.MapGraphQL("/graphql");
app.MapHub<ChatHub>("/hubs/chat");

app.Run();

public class Query
{
    [UsePaging]
    [UseProjection]
    [UseFiltering]
    [UseSorting]
    public IQueryable<User> GetUsers([Service] SecureChatDbContext db) => db.Users;

    [UsePaging]
    [UseProjection]
    [UseFiltering]
    [UseSorting]
    public IQueryable<Conversation> GetConversations([Service] SecureChatDbContext db) => db.Conversations;

    [UsePaging]
    [UseProjection]
    [UseFiltering]
    [UseSorting]
    public IQueryable<Message> GetMessages([Service] SecureChatDbContext db) => db.Messages;

    [UsePaging]
    [UseProjection]
    [UseFiltering]
    [UseSorting]
    public IQueryable<SecurityAlert> GetSecurityAlerts([Service] SecureChatDbContext db) => db.SecurityAlerts;

    [UsePaging]
    [UseProjection]
    [UseFiltering]
    [UseSorting]
    public IQueryable<DeviceSession> GetDeviceSessions([Service] SecureChatDbContext db) => db.DeviceSessions;
}

public class Mutation
{
    public async Task<User> RegisterUser(
        string username,
        string email,
        string password,
        string publicKey,
        [Service] SecureChatDbContext db)
    {
        // NOTE: replace with a strong password hashing algorithm in production.
        var passwordHash = Convert.ToBase64String(Encoding.UTF8.GetBytes(password));

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = email,
            PasswordHash = passwordHash,
            PublicKey = publicKey,
            CreatedAt = DateTime.UtcNow
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    private static readonly Dictionary<string, int> FailedLoginAttempts = new();

    public async Task<AuthPayload> LoginUser(
        string usernameOrEmail,
        string password,
        [Service] SecureChatDbContext db,
        [Service] IConfiguration config,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var user = await db.Users
            .FirstOrDefaultAsync(u =>
                u.Username == usernameOrEmail || u.Email == usernameOrEmail);

        if (user == null)
        {
            IncrementFailedAttempts(usernameOrEmail, null, db);
            throw new GraphQLException("Invalid credentials");
        }

        var passwordHash = Convert.ToBase64String(Encoding.UTF8.GetBytes(password));
        if (user.PasswordHash != passwordHash)
        {
            IncrementFailedAttempts(usernameOrEmail, user, db);
            throw new GraphQLException("Invalid credentials");
        }

        ResetFailedAttempts(usernameOrEmail);

        user.LastLogin = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var jwtSection = config.GetSection("Jwt");
        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSection["Key"]!));

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, user.Username)
        };

        var creds = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: jwtSection["Issuer"],
            audience: jwtSection["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(12),
            signingCredentials: creds);

        var accessToken = new JwtSecurityTokenHandler().WriteToken(token);

        var httpContext = httpContextAccessor.HttpContext;
        var deviceName = httpContext?.Request.Headers.UserAgent.ToString() ?? "Unknown";
        var ipAddress = httpContext?.Connection.RemoteIpAddress?.ToString() ?? "Unknown";

        var existingSession = await db.DeviceSessions
            .Where(d => d.UserId == user.Id)
            .OrderByDescending(d => d.CreatedAt)
            .FirstOrDefaultAsync();

        var isNewDevice = existingSession == null || !string.Equals(existingSession.DeviceName, deviceName, StringComparison.Ordinal);
        var isNewIp = existingSession == null || !string.Equals(existingSession.IPAddress, ipAddress, StringComparison.Ordinal);

        var deviceSession = new DeviceSession
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            DeviceName = deviceName,
            IPAddress = ipAddress,
            LoginLocation = "Unknown",
            CreatedAt = DateTime.UtcNow
        };
        db.DeviceSessions.Add(deviceSession);

        if (isNewDevice)
        {
            db.SecurityAlerts.Add(new SecurityAlert
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                AlertType = "NewDeviceLogin",
                Description = $"New device login detected: {deviceName} from {ipAddress}.",
                CreatedAt = DateTime.UtcNow,
                Resolved = false
            });
        }

        if (isNewIp)
        {
            db.SecurityAlerts.Add(new SecurityAlert
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                AlertType = "NewIPLocation",
                Description = $"New IP address detected: {ipAddress} on device {deviceName}.",
                CreatedAt = DateTime.UtcNow,
                Resolved = false
            });
        }

        var refreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = Guid.NewGuid().ToString("N"),
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            DeviceName = deviceName,
            IPAddress = ipAddress
        };
        db.RefreshTokens.Add(refreshToken);

        await db.SaveChangesAsync();

        return new AuthPayload
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken.Token,
            User = user
        };
    }

    public async Task<Message> SendMessage(
        Guid conversationId,
        string content,
        [Service] SecureChatDbContext db,
        [Service] IHubContext<ChatHub> hubContext,
        [Service] IAesEncryptionService encryptionService,
        [Service] IConfiguration config,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var claimsPrincipal = httpContextAccessor.HttpContext?.User
                              ?? throw new GraphQLException("Unauthorized");

        var userIdClaim = claimsPrincipal.FindFirstValue(JwtRegisteredClaimNames.Sub)
                         ?? throw new GraphQLException("Unauthorized");

        var message = new Message
        {
            Id = Guid.NewGuid(),
            SenderId = Guid.Parse(userIdClaim),
            ConversationId = conversationId,
            EncryptedContent = encryptionService.Encrypt(
                content,
                config.GetSection("Encryption")["MessageKey"]!),
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false
        };

        db.Messages.Add(message);
        await db.SaveChangesAsync();

        await hubContext.Clients.Group(conversationId.ToString())
            .SendAsync("ReceiveMessage", message);

        return message;
    }

    public async Task<Conversation> CreateConversation(
        bool isGroup,
        [Service] SecureChatDbContext db)
    {
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            IsGroup = isGroup,
            CreatedAt = DateTime.UtcNow
        };

        db.Conversations.Add(conversation);
        await db.SaveChangesAsync();
        return conversation;
    }

    public async Task<SecurityAlert> ResolveSecurityAlert(
        Guid alertId,
        [Service] SecureChatDbContext db)
    {
        var alert = await db.SecurityAlerts.FirstOrDefaultAsync(a => a.Id == alertId)
                    ?? throw new GraphQLException("Alert not found");

        alert.Resolved = true;
        await db.SaveChangesAsync();
        return alert;
    }

    public async Task<AuthPayload> RefreshToken(
        string refreshToken,
        [Service] SecureChatDbContext db,
        [Service] IConfiguration config)
    {
        var stored = await db.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r =>
                r.Token == refreshToken &&
                r.ExpiresAt > DateTime.UtcNow &&
                r.RevokedAt == null);

        if (stored == null)
        {
            throw new GraphQLException("Invalid refresh token");
        }

        var jwtSection = config.GetSection("Jwt");
        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSection["Key"]!));

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, stored.UserId.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, stored.User.Username)
        };

        var creds = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: jwtSection["Issuer"],
            audience: jwtSection["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(12),
            signingCredentials: creds);

        var accessToken = new JwtSecurityTokenHandler().WriteToken(token);

        return new AuthPayload
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            User = stored.User
        };
    }

    public async Task<bool> LogoutFromAllDevices(
        [Service] SecureChatDbContext db,
        [Service] IHttpContextAccessor httpContextAccessor)
    {
        var claimsPrincipal = httpContextAccessor.HttpContext?.User
                              ?? throw new GraphQLException("Unauthorized");

        var userIdClaim = claimsPrincipal.FindFirstValue(JwtRegisteredClaimNames.Sub)
                         ?? throw new GraphQLException("Unauthorized");

        var userId = Guid.Parse(userIdClaim);

        var tokens = await db.RefreshTokens
            .Where(r => r.UserId == userId && r.RevokedAt == null)
            .ToListAsync();

        foreach (var token in tokens)
        {
            token.RevokedAt = DateTime.UtcNow;
        }

        var sessions = await db.DeviceSessions
            .Where(d => d.UserId == userId)
            .ToListAsync();
        db.DeviceSessions.RemoveRange(sessions);

        await db.SaveChangesAsync();
        return true;
    }

    private static void IncrementFailedAttempts(string usernameOrEmail, User? user, SecureChatDbContext db)
    {
        lock (FailedLoginAttempts)
        {
            FailedLoginAttempts.TryGetValue(usernameOrEmail, out var count);
            count++;
            FailedLoginAttempts[usernameOrEmail] = count;

            if (count > 5 && user != null)
            {
                db.SecurityAlerts.Add(new SecurityAlert
                {
                    Id = Guid.NewGuid(),
                    UserId = user.Id,
                    AlertType = "ExcessiveFailedLogins",
                    Description = $"More than 5 failed login attempts for {usernameOrEmail}.",
                    CreatedAt = DateTime.UtcNow,
                    Resolved = false
                });
                db.SaveChanges();
            }
        }
    }

    private static void ResetFailedAttempts(string usernameOrEmail)
    {
        lock (FailedLoginAttempts)
        {
            if (FailedLoginAttempts.ContainsKey(usernameOrEmail))
            {
                FailedLoginAttempts.Remove(usernameOrEmail);
            }
        }
    }
}

public class ChatHub : Hub
{
    public Task JoinConversation(string conversationId) =>
        Groups.AddToGroupAsync(Context.ConnectionId, conversationId);
}
