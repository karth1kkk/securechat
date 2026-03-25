using System;

namespace SecureChatBackend.Application.Services;

public sealed class MessageDto
{
    public MessageDto(
        Guid id,
        Guid conversationId,
        Guid senderId,
        string encryptedContent,
        string encryptedKey,
        string nonce,
        string tag,
        string? signature,
        DateTime createdAt,
        DateTime? expiryTime)
    {
        Id = id;
        ConversationId = conversationId;
        SenderId = senderId;
        EncryptedContent = encryptedContent;
        EncryptedKey = encryptedKey;
        Nonce = nonce;
        Tag = tag;
        Signature = signature;
        CreatedAt = createdAt;
        ExpiryTime = expiryTime;
    }

    public Guid Id { get; }
    public Guid ConversationId { get; }
    public Guid SenderId { get; }
    public string EncryptedContent { get; }
    public string EncryptedKey { get; }
    public string Nonce { get; }
    public string Tag { get; }
    public string? Signature { get; }
    public DateTime CreatedAt { get; }
    public DateTime? ExpiryTime { get; }
}
