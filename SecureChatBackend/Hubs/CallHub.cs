using System;
using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using SecureChatBackend.Application.Interfaces;

namespace SecureChatBackend.Hubs;

[Authorize]
public sealed class CallHub : Hub<ICallClient>
{
    /// <summary>
    /// Tracks who is already in a call so a new joiner receives PeerJoined for each existing participant.
    /// Without this, the peer with the lexicographically greater user id may never see the other side and no offer is sent.
    /// </summary>
    private static readonly ConcurrentDictionary<Guid, ConcurrentDictionary<string, string>> CallMembersByConversation = new();

    private readonly IConversationService _conversationService;
    private readonly ILogger<CallHub> _logger;

    public CallHub(IConversationService conversationService, ILogger<CallHub> logger)
    {
        _conversationService = conversationService;
        _logger = logger;
    }

    public static string GetGroupName(Guid conversationId) => $"call-{conversationId}";

    /// <summary>Per-user group so invite/hangup reach peers that have not joined the call group yet.</summary>
    public static string GetUserListenGroupName(Guid userId) => $"call-listen-{userId}";

    public async Task RegisterForIncomingCalls()
    {
        var userId = GetCurrentUserId();
        await Groups.AddToGroupAsync(Context.ConnectionId, GetUserListenGroupName(userId));
    }

    public async Task JoinCall(Guid conversationId)
    {
        var userId = GetCurrentUserId();
        var allowed = await _conversationService.IsParticipantAsync(conversationId, userId);
        if (!allowed)
        {
            throw new HubException("Access to the call is denied.");
        }

        var groupName = GetGroupName(conversationId);
        var members = CallMembersByConversation.GetOrAdd(conversationId, _ => new ConcurrentDictionary<string, string>());

        foreach (var existingUserId in members.Values.Distinct())
        {
            await Clients.Client(Context.ConnectionId).PeerJoined(existingUserId);
        }

        members[Context.ConnectionId] = userId.ToString();
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        await Clients.OthersInGroup(groupName).PeerJoined(userId.ToString());
    }

    public async Task LeaveCall(Guid conversationId)
    {
        var userId = GetCurrentUserId();
        var allowed = await _conversationService.IsParticipantAsync(conversationId, userId);
        if (!allowed)
        {
            throw new HubException("Access to the call is denied.");
        }

        var groupName = GetGroupName(conversationId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);

        if (CallMembersByConversation.TryGetValue(conversationId, out var members))
        {
            members.TryRemove(Context.ConnectionId, out _);
            if (members.IsEmpty)
            {
                CallMembersByConversation.TryRemove(conversationId, out _);
            }
        }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        foreach (var kvp in CallMembersByConversation.ToArray())
        {
            if (kvp.Value.TryRemove(Context.ConnectionId, out _) && kvp.Value.IsEmpty)
            {
                CallMembersByConversation.TryRemove(kvp.Key, out _);
            }
        }

        await base.OnDisconnectedAsync(exception);
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
        signal.ConversationId = conversationId;

        var type = signal.Type ?? "";
        // Invite/decline/hangup must reach peers even if they have not called JoinCall yet (not in call-{conv}).
        if (type.Equals("invite", StringComparison.OrdinalIgnoreCase)
            || type.Equals("decline", StringComparison.OrdinalIgnoreCase)
            || type.Equals("hangup", StringComparison.OrdinalIgnoreCase))
        {
            var others = await _conversationService.GetOtherAcceptedParticipantIdsAsync(conversationId, userId, CancellationToken.None);
            if (others.Count == 0 && type.Equals("invite", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning(
                    "Call invite has no recipient user groups (conversation {ConversationId}). Other user may not have accepted the chat yet, or data is out of sync.",
                    conversationId);
            }

            foreach (var peerId in others)
            {
                await Clients.Group(GetUserListenGroupName(peerId)).ReceiveSignal(signal);
            }

            return;
        }

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
