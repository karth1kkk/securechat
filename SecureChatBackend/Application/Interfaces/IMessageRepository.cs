using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using SecureChatBackend.Domain.Entities;

namespace SecureChatBackend.Application.Interfaces;

public interface IMessageRepository
{
    Task AddAsync(Message message, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Message>> GetMessagesAsync(Guid conversationId, int limit, DateTime? since, CancellationToken cancellationToken = default);
}
