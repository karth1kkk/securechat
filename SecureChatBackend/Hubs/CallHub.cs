using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using SecureChatBackend.Application.Interfaces;

namespace SecureChatBackend.Hubs;

[Authorize]
public sealed class CallHub : Hub<ICallClient>
{
    private readonly IConversationService _conversationService;

    public CallHub(IConversationService conversationService)
    {
        _conversationService = conversationService;
    }

    public static string GetGroupName(Guid conversationId) => $"call-{conversationId}";

    public async Task JoinCall(Guid conversationId)
    {
        var userId = GetCurrentUserId();
        var allowed = await _conversationService.IsParticipantAsync(conversationId, userId);
        if (!allowed)
        {
            throw new HubException("Access to the call is denied.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GetGroupName(conversationId));
        await Clients.OthersInGroup(GetGroupName(conversationId)).PeerJoined(userId.ToString());
    }

    public async Task SendSignal(Guid conversationId, CallSignalDto signal)
    {
        var userId = GetCurrentUserId();
        var allowed = await _conversationService.IsParticipantAsync(conversationId, userId);
        if (!allowed)
        {
            throw new HubException("Access to the call is denied.");
        }

        signal.SenderId = userId;
        await Clients.OthersInGroup(GetGroupName(conversationId)).ReceiveSignal(signal);
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = Context.User?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                          ?? Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
        {
            throw new HubException("Invalid authentication token.");
        }

        return userId;
    }
}
