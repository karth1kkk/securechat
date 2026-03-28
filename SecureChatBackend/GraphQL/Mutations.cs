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
    public Task<SessionRegistrationResult> RegisterAnonymousAsync(
        [Service] IUserService userService,
        RegisterUserInput input,
        CancellationToken cancellationToken = default)
    {
        var deviceName = string.IsNullOrWhiteSpace(input.DeviceName) ? "unknown" : input.DeviceName;
        return userService.RegisterAnonymousAsync(input.PublicKey, deviceName, cancellationToken);
    }

    [Authorize]
    public Task<ConversationDto> CreateConversationAsync(
        [Service] IConversationService conversationService,
        [Service] IHttpContextAccessor httpContextAccessor,
        CreateConversationInput input,
        CancellationToken cancellationToken = default)
    {
        var userId = GetCurrentUserId(httpContextAccessor);
        var participants = input.ParticipantIds.Append(userId).Distinct();
        return conversationService.CreateConversationAsync(participants, input.IsGroup, cancellationToken);
    }

    [Authorize]
    public Task<ConversationDto> CreateConversationWithSessionIdAsync(
        [Service] IConversationService conversationService,
        [Service] IHttpContextAccessor httpContextAccessor,
        CreateConversationWithSessionIdInput input,
        CancellationToken cancellationToken = default)
    {
        var userId = GetCurrentUserId(httpContextAccessor);
        return conversationService.CreateConversationRequestWithSessionIdAsync(userId, input.SessionId, cancellationToken);
    }

    [Authorize]
    public Task<MessageDto> SendMessageAsync(
        [Service] IMessageService messageService,
        [Service] IHttpContextAccessor httpContextAccessor,
        SendMessageInput input,
        CancellationToken cancellationToken = default)
    {
        var userId = GetCurrentUserId(httpContextAccessor);
        return messageService.SendMessageAsync(
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

    [Authorize]
    public Task<ConversationDto> CreateConversationRequestAsync(
        [Service] IConversationService conversationService,
        [Service] IHttpContextAccessor httpContextAccessor,
        CreateConversationRequestInput input,
        CancellationToken cancellationToken = default)
    {
        var requesterId = GetCurrentUserId(httpContextAccessor);
        return conversationService.CreateConversationRequestAsync(requesterId, input.TargetUserId, cancellationToken);
    }

    [Authorize]
    public Task<ConversationDto> AcceptConversationRequestAsync(
        [Service] IConversationService conversationService,
        [Service] IHttpContextAccessor httpContextAccessor,
        AcceptConversationRequestInput input,
        CancellationToken cancellationToken = default)
    {
        var userId = GetCurrentUserId(httpContextAccessor);
        // Update state then fetch updated conversation by id.
        return HandleAcceptAndFetch(conversationService, input.ConversationId, userId, cancellationToken);
    }

    private async Task<ConversationDto> HandleAcceptAndFetch(
        IConversationService conversationService,
        Guid conversationId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        await conversationService.AcceptConversationRequestAsync(conversationId, userId, cancellationToken);
        // After acceptance, conversation is treated as accepted for that user.
        // We can fetch via GetConversationsAsync and pick the match.
        var accepted = await conversationService.GetConversationsAsync(userId, isAccepted: true, cancellationToken);
        var match = accepted.FirstOrDefault(c => c.Id == conversationId);
        if (match == null)
        {
            // Fallback: if query didn't include due to timing, surface a clear error.
            throw new InvalidOperationException("Accepted conversation not found.");
        }
        return match;
    }

    [Authorize]
    public async Task<bool> DeclineConversationRequestAsync(
        [Service] IConversationService conversationService,
        [Service] IHttpContextAccessor httpContextAccessor,
        DeclineConversationRequestInput input,
        CancellationToken cancellationToken = default)
    {
        var userId = GetCurrentUserId(httpContextAccessor);
        await conversationService.DeclineConversationRequestAsync(input.ConversationId, userId, cancellationToken);
        return true;
    }

    [Authorize]
    public async Task<bool> DeleteConversationAsync(
        [Service] IConversationService conversationService,
        [Service] IHttpContextAccessor httpContextAccessor,
        DeleteConversationInput input,
        CancellationToken cancellationToken = default)
    {
        var userId = GetCurrentUserId(httpContextAccessor);
        await conversationService.DeleteConversationAsync(input.ConversationId, userId, cancellationToken);
        return true;
    }

    [Authorize]
    public async Task<bool> UpdateUsernameAsync(
        [Service] IUserService userService,
        [Service] IHttpContextAccessor httpContextAccessor,
        UpdateUsernameInput input,
        CancellationToken cancellationToken = default)
    {
        var userId = GetCurrentUserId(httpContextAccessor);
        await userService.UpdateUsernameAsync(userId, input.Username, cancellationToken);
        return true;
    }

    private static Guid GetCurrentUserId(IHttpContextAccessor httpContextAccessor)
    {
        var context = httpContextAccessor.HttpContext ?? throw new InvalidOperationException("HttpContext is not available.");
        return ParseUserId(context.User);
    }

    private static Guid ParseUserId(ClaimsPrincipal user)
    {
        var userIdClaim = user.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                           ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
        {
            throw new InvalidOperationException("User identifier is missing from claims.");
        }

        return userId;
    }
}
