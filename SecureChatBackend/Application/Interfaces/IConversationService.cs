using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using SecureChatBackend.Application.Services;

namespace SecureChatBackend.Application.Interfaces;

public interface IConversationService
{
    Task<ConversationDto> CreateConversationAsync(IEnumerable<Guid> participantIds, bool isGroup, CancellationToken cancellationToken = default);
    Task<ConversationDto> CreateConversationRequestAsync(Guid requesterId, Guid targetId, CancellationToken cancellationToken = default);
    Task<bool> IsParticipantAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ConversationDto>> GetConversationsAsync(Guid userId, bool isAccepted, CancellationToken cancellationToken = default);
    Task AcceptConversationRequestAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default);
    Task DeclineConversationRequestAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default);
}
