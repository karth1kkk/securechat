using System;

namespace SecureChatBackend.GraphQL.Inputs;

public sealed class SendMessageInput
{
    public Guid ConversationId { get; set; }
    public string EncryptedContent { get; set; } = null!;
    public string EncryptedKey { get; set; } = null!;
    public string Nonce { get; set; } = null!;
    public string Tag { get; set; } = null!;
    public string? Signature { get; set; }
    public DateTime? ExpiryTime { get; set; }
}
