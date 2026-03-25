using System;

namespace SecureChatBackend.Domain.Entities;

public sealed class Message
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ConversationId { get; set; }
    public Conversation Conversation { get; set; } = null!;
    public Guid SenderId { get; set; }
    public User Sender { get; set; } = null!;
    public string EncryptedContent { get; set; } = null!;
    public string EncryptedKey { get; set; } = null!;
    public string Nonce { get; set; } = null!;
    public string Tag { get; set; } = null!;
    public string? Signature { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiryTime { get; set; }
}
