using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using SecureChatBackend.Application.Interfaces;
using SecureChatBackend.Domain.Entities;
using SecureChatBackend.Infrastructure.Data;

namespace SecureChatBackend.Infrastructure.Repositories;

public sealed class MessageRepository : IMessageRepository
{
    private readonly SecureChatDbContext _context;

    public MessageRepository(SecureChatDbContext context)
    {
        _context = context;
    }

    public Task AddAsync(Message message, CancellationToken cancellationToken = default)
    {
        return _context.Messages.AddAsync(message, cancellationToken).AsTask();
    }

    public async Task<IReadOnlyList<Message>> GetMessagesAsync(Guid conversationId, int limit, DateTime? since, CancellationToken cancellationToken = default)
    {
        var query = _context.Messages
            .Where(m => m.ConversationId == conversationId)
            .Where(m => m.ExpiryTime == null || m.ExpiryTime > DateTime.UtcNow);

        if (since.HasValue)
        {
            query = query.Where(m => m.CreatedAt >= since.Value);
        }

        return await query
            .OrderBy(m => m.CreatedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }
}
