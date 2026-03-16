using SecureChat.Domain.Entities;

namespace SecureChat.Application.GraphQL;

public class AuthPayload
{
    public string AccessToken { get; set; } = default!;
    public string RefreshToken { get; set; } = default!;
    public User User { get; set; } = default!;
}

