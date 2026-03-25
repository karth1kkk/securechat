using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using SecureChatBackend.Application.Interfaces;
using SecureChatBackend.Domain.Entities;
using SecureChatBackend.Infrastructure.Data;

namespace SecureChatBackend.Infrastructure.Repositories;

public sealed class UserRepository : IUserRepository
{
    private readonly SecureChatDbContext _context;

    public UserRepository(SecureChatDbContext context)
    {
        _context = context;
    }

    public Task<User?> GetBySessionIdAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        return _context.Users.Include(u => u.Devices).FirstOrDefaultAsync(u => u.SessionId == sessionId, cancellationToken);
    }

    public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return _context.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
    }

    public Task AddAsync(User user, CancellationToken cancellationToken = default)
    {
        return _context.Users.AddAsync(user, cancellationToken).AsTask();
    }

    public void Update(User user)
    {
        _context.Users.Update(user);
    }
}
