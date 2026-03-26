using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using System;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SecureChatBackend.Application.Interfaces;
using SecureChatBackend.Application.Services;
using SecureChatBackend.Auth;
using SecureChatBackend.GraphQL;
using SecureChatBackend.Hubs;
using SecureChatBackend.Infrastructure.Data;
using SecureChatBackend.Infrastructure.Repositories;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls("http://localhost:5002");

builder.Configuration.AddEnvironmentVariables();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
var useInMemory = builder.Configuration.GetValue<bool>("Database:UseInMemory");
if (useInMemory)
{
    Console.WriteLine("Development mode: using in-memory database.");
    builder.Services.AddDbContext<SecureChatDbContext>(options => options.UseInMemoryDatabase("SecureChat"));
}
else if (!string.IsNullOrWhiteSpace(connectionString))
{
    builder.Services.AddDbContext<SecureChatDbContext>(options => options.UseNpgsql(connectionString));
}
else
{
    Console.WriteLine("Postgres connection string not set; falling back to in-memory database.");
    builder.Services.AddDbContext<SecureChatDbContext>(options => options.UseInMemoryDatabase("SecureChat"));
}

builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));
var jwtSection = builder.Configuration.GetSection("JwtSettings");
var jwtSettings = jwtSection.Get<JwtSettings>() ?? throw new InvalidOperationException("JwtSettings are not configured.");
var secretValue = jwtSettings.Secret;
if (string.IsNullOrWhiteSpace(secretValue))
{
    secretValue = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
    jwtSettings.Secret = secretValue;
}
var secret = Encoding.UTF8.GetBytes(secretValue);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = true;
        options.SaveToken = true;
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

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    {
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

builder.Services.AddSignalR();

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
    .AddAuthorization()
    .AddQueryType<Query>()
    .AddMutationType<Mutation>();

var app = builder.Build();

app.UseRateLimiter();
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

app.UseAuthentication();
app.UseAuthorization();

app.MapGraphQL().RequireCors("default");
app.MapHub<MessagingHub>("/hubs/messaging");

app.Run();
