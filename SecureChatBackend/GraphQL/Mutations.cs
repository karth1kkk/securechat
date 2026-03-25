using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using HotChocolate.Authorization;
using Microsoft.AspNetCore.Http;
using SecureChatBackend.Application.Interfaces;
using SecureChatBackend.Application.Services;
using SecureChatBackend.GraphQL.Inputs;

namespace SecureChatBackend.GraphQL;

public sealed class Mutation
{
    private readonly IUserService _userService;
    private readonly IConversationService _conversationService;
    private readonly IMessageService _messageService;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public Mutation(IUserService userService, IConversationService conversationService, IMessageService messageService, IHttpContextAccessor httpContextAccessor)
    {
        _userService = userService;
        _conversationService = conversationService;
        _messageService = messageService;
        _httpContextAccessor = httpContextAccessor;
    }

    public Task<SessionRegistrationResult> RegisterAnonymousAsync(RegisterUserInput input, CancellationToken cancellationToken = default)
    {
        var deviceName = string.IsNullOrWhiteSpace(input.DeviceName) ? "unknown" : input.DeviceName;
        return _userService.RegisterAnonymousAsync(input.PublicKey, deviceName, cancellationToken);
    }

    [Authorize]
    public Task<ConversationDto> CreateConversationAsync(CreateConversationInput input, CancellationToken cancellationToken = default)
    {
        var userId = GetCurrentUserId();
        var participants = input.ParticipantIds.Append(userId).Distinct();
        return _conversationService.CreateConversationAsync(participants, input.IsGroup, cancellationToken);
    }

    [Authorize]
    public Task<MessageDto> SendMessageAsync(SendMessageInput input, CancellationToken cancellationToken = default)
    {
        var userId = GetCurrentUserId();
        return _messageService.SendMessageAsync(
            input.ConversationId,
            userId,
            input.EncryptedContent,
            input.EncryptedKey,
            input.Nonce,
            input.Tag,
            input.Signature,
            input.ExpiryTime,
            cancellationToken);
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
