using System;
using System.Threading;
using System.Threading.Tasks;
using SecureChatBackend.Domain.Entities;

namespace SecureChatBackend.Application.Interfaces;

public interface IConversationRepository
{
    Task<Conversation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default);
}
