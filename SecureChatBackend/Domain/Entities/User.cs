using System;
using System.Collections.Generic;

namespace SecureChatBackend.Domain.Entities;

public sealed class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string SessionId { get; set; } = null!;
    public string PublicKey { get; set; } = null!;
    public string? Username { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Device> Devices { get; set; } = new List<Device>();
    public ICollection<ConversationParticipant> ConversationParticipants { get; set; } = new List<ConversationParticipant>();
}
