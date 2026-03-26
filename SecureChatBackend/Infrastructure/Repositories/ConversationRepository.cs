using System;
using System.Collections.Generic;
using System.Threading;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using SecureChatBackend.Application.Interfaces;
using SecureChatBackend.Domain.Entities;
using SecureChatBackend.Infrastructure.Data;

namespace SecureChatBackend.Infrastructure.Repositories;

public sealed class ConversationRepository : IConversationRepository
{
    private readonly SecureChatDbContext _context;

    public ConversationRepository(SecureChatDbContext context)
    {
        _context = context;
    }

    public Task<Conversation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return _context.Conversations
            .Include(c => c.Participants)
            .ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
    }

    public Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default)
    {
        return _context.Conversations.AddAsync(conversation, cancellationToken).AsTask();
    }

    public async Task<IReadOnlyList<Conversation>> GetByUserAsync(Guid userId, bool isAccepted, CancellationToken cancellationToken = default)
    {
        var list = await _context.Conversations
            .Include(c => c.Participants)
            .ThenInclude(p => p.User)
            .Where(c => c.Participants.Any(p => p.UserId == userId && p.IsAccepted == isAccepted))
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(cancellationToken);

        return list;
    }

    public async Task DeleteAsync(Guid conversationId, CancellationToken cancellationToken = default)
    {
        var conversation = await _context.Conversations.FirstOrDefaultAsync(c => c.Id == conversationId, cancellationToken);
        if (conversation != null)
        {
            _context.Conversations.Remove(conversation);
            // SaveChanges is handled by UnitOfWork in services.
        }
    }
}
