using System;
using System.Collections.Generic;
using System.Linq;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using HotChocolate;
using HotChocolate.Authorization;
using Microsoft.AspNetCore.Http;
using SecureChatBackend.Application.Interfaces;
using SecureChatBackend.Application.Services;

namespace SecureChatBackend.GraphQL;

public sealed class Query
{
    [GraphQLName("userBySessionId")]
    public async Task<UserDto?> GetUserBySessionIdAsync(
        [Service] IUserService userService,
        string sessionId,
        CancellationToken cancellationToken = default)
    {
        var user = await userService.GetBySessionIdAsync(sessionId, cancellationToken);
        if (user == null)
        {
            return null;
        }

        return new UserDto(user.Id, user.SessionId, user.PublicKey, user.CreatedAt, user.Username);
    }

    [Authorize]
    public Task<IReadOnlyList<MessageDto>> GetMessagesAsync(
        [Service] IMessageService messageService,
        [Service] IHttpContextAccessor httpContextAccessor,
        Guid conversationId,
        int limit = 50,
        DateTime? since = null,
        CancellationToken cancellationToken = default)
    {
        var clampedLimit = Math.Clamp(limit, 1, 200);
        var context = httpContextAccessor.HttpContext ?? throw new InvalidOperationException("HttpContext is not available.");
        var userIdClaim = context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                           ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
        {
            throw new InvalidOperationException("User identifier is missing from claims.");
        }

        return messageService.GetMessagesAsync(conversationId, userId, clampedLimit, since, cancellationToken);
    }

    [GraphQLName("myConversationsAsync")]
    [Authorize]
    public Task<IReadOnlyList<ConversationDto>> MyConversationsAsync(
        [Service] IConversationService conversationService,
        [Service] IHttpContextAccessor httpContextAccessor,
        CancellationToken cancellationToken = default)
    {
        var context = httpContextAccessor.HttpContext ?? throw new InvalidOperationException("HttpContext is not available.");
        var userIdClaim = context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                           ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
        {
            throw new InvalidOperationException("User identifier is missing from claims.");
        }

        return conversationService.GetConversationsAsync(userId, isAccepted: true, cancellationToken);
    }

    [GraphQLName("myConversationRequestsAsync")]
    [Authorize]
    public Task<IReadOnlyList<ConversationDto>> MyConversationRequestsAsync(
        [Service] IConversationService conversationService,
        [Service] IHttpContextAccessor httpContextAccessor,
        CancellationToken cancellationToken = default)
    {
        var context = httpContextAccessor.HttpContext ?? throw new InvalidOperationException("HttpContext is not available.");
        var userIdClaim = context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                           ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
        {
            throw new InvalidOperationException("User identifier is missing from claims.");
        }

        return conversationService.GetConversationsAsync(userId, isAccepted: false, cancellationToken);
    }

    [GraphQLName("conversationById")]
    [Authorize]
    public async Task<ConversationDto?> GetConversationByIdAsync(
        [Service] IConversationRepository conversationRepository,
        [Service] IHttpContextAccessor httpContextAccessor,
        Guid conversationId,
        CancellationToken cancellationToken = default)
    {
        var context = httpContextAccessor.HttpContext ?? throw new InvalidOperationException("HttpContext is not available.");
        var userIdClaim = context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                           ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
        {
            throw new InvalidOperationException("User identifier is missing from claims.");
        }

        var conversation = await conversationRepository.GetByIdAsync(conversationId, cancellationToken);
        if (conversation == null)
        {
            return null;
        }

        if (!conversation.Participants.Any(p => p.UserId == userId && p.IsAccepted))
        {
            throw new InvalidOperationException("Requester is not a participant in the conversation.");
        }

        var participants = conversation.Participants
            .Select(p => new ParticipantDto(p.UserId, p.User.PublicKey, p.User.SessionId, p.User.Username))
            .ToList();
        return new ConversationDto(conversation.Id, conversation.IsGroup, conversation.CreatedAt, conversation.LastMessageAt, participants);
    }
}
