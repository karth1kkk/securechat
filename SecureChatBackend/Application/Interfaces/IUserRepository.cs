using System;
using System.Threading;
using System.Threading.Tasks;
using SecureChatBackend.Domain.Entities;

namespace SecureChatBackend.Application.Interfaces;

public interface IUserRepository
{
    Task<User?> GetBySessionIdAsync(string sessionId, CancellationToken cancellationToken = default);
    Task<User?> GetByPublicKeyAsync(string publicKey, CancellationToken cancellationToken = default);
    Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task AddAsync(User user, CancellationToken cancellationToken = default);
    void Update(User user);
}
