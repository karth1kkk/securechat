using System.Threading;
using System.Threading.Tasks;
using SecureChatBackend.Application.Services;
using SecureChatBackend.Domain.Entities;

namespace SecureChatBackend.Application.Interfaces;

public interface IUserService
{
    Task<SessionRegistrationResult> RegisterAnonymousAsync(string publicKey, string deviceName, CancellationToken cancellationToken = default);
    Task<User?> GetBySessionIdAsync(string sessionId, CancellationToken cancellationToken = default);
    Task UpdateUsernameAsync(Guid userId, string? username, CancellationToken cancellationToken = default);
}
