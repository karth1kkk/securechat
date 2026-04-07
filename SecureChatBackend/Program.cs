using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.RateLimiting;
using System;
using System.IdentityModel.Tokens.Jwt;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SecureChatBackend.Application.Interfaces;
using SecureChatBackend.Application.Services;
using SecureChatBackend.Auth;
using SecureChatBackend.Configuration;
using SecureChatBackend.GraphQL;
using SecureChatBackend.Hubs;
using SecureChatBackend.Infrastructure.Data;
using SecureChatBackend.Infrastructure.Repositories;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// Local dev default; set ASPNETCORE_URLS (e.g. http://+:8080) in Docker/ECS so Kestrel binds correctly.
if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")))
{
    builder.WebHost.UseUrls("http://localhost:5002");
}

builder.Configuration.AddEnvironmentVariables();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
var useInMemory = builder.Configuration.GetValue("Database:UseInMemory", true);
if (useInMemory)
{
    Console.WriteLine("Using in-memory database (Database:UseInMemory enabled).");
    builder.Services.AddDbContext<SecureChatDbContext>(options => options.UseInMemoryDatabase("SecureChat"));
}
else if (!string.IsNullOrWhiteSpace(connectionString))
{
    try
    {
        using var testConnection = new NpgsqlConnection(connectionString);
        testConnection.Open();
        testConnection.Close();
        builder.Services.AddDbContext<SecureChatDbContext>(options => options.UseNpgsql(connectionString));
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Postgres connection failed ({ex.Message}); falling back to in-memory database.");
        builder.Services.AddDbContext<SecureChatDbContext>(options => options.UseInMemoryDatabase("SecureChat"));
    }
}
else
{
    Console.WriteLine("Postgres connection string not set; falling back to in-memory database.");
    builder.Services.AddDbContext<SecureChatDbContext>(options => options.UseInMemoryDatabase("SecureChat"));
}

var jwtSection = builder.Configuration.GetSection("JwtSettings");
var jwtSettings = jwtSection.Get<JwtSettings>() ?? throw new InvalidOperationException("JwtSettings are not configured.");
var secretValue = jwtSettings.Secret;
if (string.IsNullOrWhiteSpace(secretValue))
{
    secretValue = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
    jwtSection["Secret"] = secretValue;
}
// HS256 has a minimum key size requirement; the default placeholder secret in appsettings.json
// can be too short and will cause JWT generation to fail at runtime.
var secret = Encoding.UTF8.GetBytes(secretValue);
if (secret.Length < 32)
{
    // IMPORTANT: make it deterministic across restarts to keep existing JWTs valid.
    // Derive a fixed-length secret from the configured secret string.
    using var sha = System.Security.Cryptography.SHA256.Create();
    var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(secretValue));
    secretValue = Convert.ToBase64String(hash);
    jwtSection["Secret"] = secretValue;
    secret = Encoding.UTF8.GetBytes(secretValue);
}
builder.Services.Configure<JwtSettings>(jwtSection);
builder.Services.Configure<SecureChatNetworkOptions>(builder.Configuration.GetSection(SecureChatNetworkOptions.SectionName));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = true;
        options.SaveToken = true;
        // SignalR sends the token in the query string as `access_token` during
        // WebSockets/SSE transport negotiation. Tell the JWT handler to read it.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;

                if (!string.IsNullOrWhiteSpace(accessToken) &&
                    (path.StartsWithSegments("/hubs/messaging") || path.StartsWithSegments("/hubs/call")))
                {
                    context.Token = accessToken;
                }

                return System.Threading.Tasks.Task.CompletedTask;
            }
        };
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(secret),
            ValidateLifetime = true,
            NameClaimType = JwtRegisteredClaimNames.Sub
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddRateLimiter(options =>
{
    var rateSection = builder.Configuration.GetSection("RateLimiting");
    var permitLimit = rateSection.GetValue<int>("PermitLimit", 30);
    var windowSeconds = rateSection.GetValue<int>("WindowSeconds", 60);

    // Dev mode can run both localhost instances + polling, so relax throttling.
    if (builder.Environment.IsDevelopment())
    {
        // Make dev/testing resilient to UI polling + multiple localhost instances.
        permitLimit = Math.Max(permitLimit, 1000);
        windowSeconds = Math.Max(windowSeconds, 60);
    }

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    {
        if (context.Request.Path.StartsWithSegments("/health"))
        {
            return RateLimitPartition.GetNoLimiter("health");
        }

        if (HttpMethods.Options.Equals(context.Request.Method, StringComparison.OrdinalIgnoreCase))
        {
            return RateLimitPartition.GetNoLimiter("cors-preflight");
        }

        var sessionId = context.User?.FindFirst("session_id")?.Value;
        var partitionKey = sessionId ?? context.Connection.RemoteIpAddress?.ToString() ?? "anonymous";
        return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = permitLimit,
            Window = TimeSpan.FromSeconds(windowSeconds),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0
        });
    });

    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

builder.Services.AddHttpContextAccessor();

builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IConversationRepository, ConversationRepository>();
builder.Services.AddScoped<IMessageRepository, MessageRepository>();
builder.Services.AddScoped<IDeviceRepository, DeviceRepository>();
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();

builder.Services.AddScoped<IDeviceService, DeviceService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IConversationService, ConversationService>();
builder.Services.AddScoped<IMessageService, MessageService>();
builder.Services.AddSingleton<ISessionIdGenerator, SessionIdGenerator>();
builder.Services.AddSingleton<ITokenService, TokenService>();

builder.Services.AddSignalR()
    .AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });

var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? new[] { "http://localhost:8081", "http://localhost:8082" };
builder.Services.AddCors(options =>
{
    options.AddPolicy("default", policy =>
    {
        policy.WithOrigins(corsOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddGraphQLServer()
    // In development, return exception details to help debug "Unexpected Execution Error".
    .ModifyRequestOptions(opt => opt.IncludeExceptionDetails = builder.Environment.IsDevelopment())
    .AddAuthorization()
    .AddQueryType<Query>()
    .AddMutationType<Mutation>();

var app = builder.Build();

app.UseRouting();
app.UseCors("default");

app.Use(async (context, next) =>
{
    if (context.Request.Method == HttpMethods.Options && context.Request.Path.StartsWithSegments("/graphql"))
    {
        context.Response.StatusCode = StatusCodes.Status204NoContent;
        await context.Response.CompleteAsync();
        return;
    }

    await next();
});

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapGraphQL().RequireCors("default");
app.MapHub<MessagingHub>("/hubs/messaging");
app.MapHub<CallHub>("/hubs/call");
app.MapGet("/health", () => Results.Text("ok", "text/plain"));

app.Run();
