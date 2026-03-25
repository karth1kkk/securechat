using System;

namespace SecureChatBackend.Application.Services;

public sealed class SessionRegistrationResult
{
    public SessionRegistrationResult(Guid userId, string sessionId, string publicKey, string token)
    {
        UserId = userId;
        SessionId = sessionId;
        PublicKey = publicKey;
        Token = token;
    }

    public Guid UserId { get; }
    public string SessionId { get; }
    public string PublicKey { get; }
    public string Token { get; }
}
