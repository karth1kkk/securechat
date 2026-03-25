using System;
using System.Collections.Generic;

namespace SecureChatBackend.Application.Services;

public sealed class ConversationDto
{
    public ConversationDto(Guid id, bool isGroup, DateTime createdAt, IReadOnlyList<ParticipantDto> participants)
    {
        Id = id;
        IsGroup = isGroup;
        CreatedAt = createdAt;
        Participants = participants;
    }

    public Guid Id { get; }
    public bool IsGroup { get; }
    public DateTime CreatedAt { get; }
    public IReadOnlyList<ParticipantDto> Participants { get; }
}

public sealed class ParticipantDto
{
    public ParticipantDto(Guid userId, string publicKey)
    {
        UserId = userId;
        PublicKey = publicKey;
    }

    public Guid UserId { get; }
    public string PublicKey { get; }
}
