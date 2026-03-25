using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.IdentityModel.Tokens.Jwt;
using SecureChatBackend.Application.Interfaces;

namespace SecureChatBackend.Hubs;

[Authorize]
public sealed class MessagingHub : Hub<IMessagingClient>
{
    private readonly IConversationService _conversationService;

    public MessagingHub(IConversationService conversationService)
    {
        _conversationService = conversationService;
    }

    public static string GetGroupName(Guid conversationId) => $"conversation-{conversationId}";

    public async Task JoinConversation(Guid conversationId)
    {
        var userId = GetCurrentUserId();
        var allowed = await _conversationService.IsParticipantAsync(conversationId, userId);
        if (!allowed)
        {
            throw new HubException("Access to the conversation is denied.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GetGroupName(conversationId));
    }

    private Guid GetCurrentUserId()
    {
        var sub = Context.User?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        if (sub == null || !Guid.TryParse(sub, out var userId))
        {
            throw new HubException("Invalid authentication token.");
        }

        return userId;
    }
}
