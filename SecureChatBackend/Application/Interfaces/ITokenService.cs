using SecureChatBackend.Domain.Entities;

namespace SecureChatBackend.Application.Interfaces;

public interface ITokenService
{
    string GenerateToken(User user);
}
