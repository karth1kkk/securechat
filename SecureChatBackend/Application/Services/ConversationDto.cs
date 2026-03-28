using System;
using System.Collections.Generic;

namespace SecureChatBackend.Application.Services;

public sealed class ConversationDto
{
    public ConversationDto(Guid id, bool isGroup, DateTime createdAt, DateTime? lastMessageAt, IReadOnlyList<ParticipantDto> participants)
    {
        Id = id;
        IsGroup = isGroup;
        CreatedAt = createdAt;
        LastMessageAt = lastMessageAt;
        Participants = participants;
    }

    public Guid Id { get; }
    public bool IsGroup { get; }
    public DateTime CreatedAt { get; }
    public DateTime? LastMessageAt { get; }
    public IReadOnlyList<ParticipantDto> Participants { get; }
}

public sealed class ParticipantDto
{
    public ParticipantDto(Guid userId, string publicKey, string sessionId, string? username)
    {
        UserId = userId;
        PublicKey = publicKey;
        SessionId = sessionId;
        Username = username;
    }

    public Guid UserId { get; }
    public string PublicKey { get; }
    public string SessionId { get; }
    public string? Username { get; }
}
