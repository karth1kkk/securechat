using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using SecureChat.Domain.Entities;
using SecureChat.Infrastructure.Persistence;

namespace SecureChat.Api.Middleware;

public class LoginActivityMiddleware : IMiddleware
{
    private readonly SecureChatDbContext _db;

    public LoginActivityMiddleware(SecureChatDbContext db)
    {
        _db = db;
    }

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        // Simple example: log authenticated requests and suspicious headers.
        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        var ipAddress = context.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
        var path = context.Request.Path.Value ?? string.Empty;

        if (!string.IsNullOrEmpty(userId) && path.Contains("graphql", StringComparison.OrdinalIgnoreCase))
        {
            _db.SecurityAlerts.Add(new SecurityAlert
            {
                Id = Guid.NewGuid(),
                UserId = Guid.Parse(userId),
                AlertType = "LoginActivity",
                Description = $"User activity on path {path} from {ipAddress}.",
                CreatedAt = DateTime.UtcNow,
                Resolved = true
            });
            await _db.SaveChangesAsync();
        }

        if (context.Request.Headers.TryGetValue("X-Suspicious", out var suspicious) &&
            string.Equals(suspicious.ToString(), "true", StringComparison.OrdinalIgnoreCase) &&
            !string.IsNullOrEmpty(userId))
        {
            _db.SecurityAlerts.Add(new SecurityAlert
            {
                Id = Guid.NewGuid(),
                UserId = Guid.Parse(userId),
                AlertType = "SuspiciousRequest",
                Description = $"Suspicious request detected from {ipAddress} to {path}.",
                CreatedAt = DateTime.UtcNow,
                Resolved = false
            });
            await _db.SaveChangesAsync();
        }

        await next(context);
    }
}

