using System;

namespace SecureChatBackend.Domain.Entities;

public sealed class ConversationParticipant
{
    public Guid ConversationId { get; set; }
    public Conversation Conversation { get; set; } = null!;
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    // Pending requests are modeled as conversations where one participant hasn't accepted yet.
    // Requester is accepted immediately, target becomes accepted once they approve the request.
    public bool IsAccepted { get; set; } = false;
}
