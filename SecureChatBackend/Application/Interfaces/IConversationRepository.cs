using System;
using System.Threading;
using System.Threading.Tasks;
using SecureChatBackend.Domain.Entities;

namespace SecureChatBackend.Application.Interfaces;

public interface IConversationRepository
{
    Task<Conversation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Conversation>> GetByUserAsync(Guid userId, bool isAccepted, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid conversationId, CancellationToken cancellationToken = default);
}
