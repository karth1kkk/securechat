using System;

namespace SecureChatBackend.Application.Services;

public sealed class UserDto
{
    public UserDto(Guid id, string sessionId, string publicKey, DateTime createdAt)
    {
        Id = id;
        SessionId = sessionId;
        PublicKey = publicKey;
        CreatedAt = createdAt;
    }

    public Guid Id { get; }
    public string SessionId { get; }
    public string PublicKey { get; }
    public DateTime CreatedAt { get; }
}
