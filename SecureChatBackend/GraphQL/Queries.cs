using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using HotChocolate.Authorization;
using Microsoft.AspNetCore.Http;
using SecureChatBackend.Application.Interfaces;
using SecureChatBackend.Application.Services;

namespace SecureChatBackend.GraphQL;

public sealed class Query
{
    private readonly IUserService _userService;
    private readonly IMessageService _messageService;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public Query(IUserService userService, IMessageService messageService, IHttpContextAccessor httpContextAccessor)
    {
        _userService = userService;
        _messageService = messageService;
        _httpContextAccessor = httpContextAccessor;
    }

    public async Task<UserDto?> GetUserBySessionIdAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        var user = await _userService.GetBySessionIdAsync(sessionId, cancellationToken);
        if (user == null)
        {
            return null;
        }

        return new UserDto(user.Id, user.SessionId, user.PublicKey, user.CreatedAt);
    }

    [Authorize]
    public Task<IReadOnlyList<MessageDto>> GetMessagesAsync(Guid conversationId, int limit = 50, DateTime? since = null, CancellationToken cancellationToken = default)
    {
        var clampedLimit = Math.Clamp(limit, 1, 200);
        var userId = GetCurrentUserId();
        return _messageService.GetMessagesAsync(conversationId, userId, clampedLimit, since, cancellationToken);
    }

    private Guid GetCurrentUserId()
    {
        var context = _httpContextAccessor.HttpContext ?? throw new InvalidOperationException("HttpContext is not available.");
        return ParseUserId(context.User);
    }

    private static Guid ParseUserId(ClaimsPrincipal user)
    {
        var sub = user.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        if (sub == null || !Guid.TryParse(sub, out var userId))
        {
            throw new InvalidOperationException("User identifier is missing from claims.");
        }

        return userId;
    }
}
