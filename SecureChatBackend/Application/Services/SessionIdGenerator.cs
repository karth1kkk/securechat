using System.Security.Cryptography;
using SecureChatBackend.Application.Interfaces;

namespace SecureChatBackend.Application.Services;

public sealed class SessionIdGenerator : ISessionIdGenerator
{
    private const int SessionLength = 66;
    private const string AllowedCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    public string GenerateSessionId()
    {
        Span<byte> buffer = stackalloc byte[SessionLength];
        RandomNumberGenerator.Fill(buffer);
        var result = new char[SessionLength];
        for (var i = 0; i < SessionLength; i++)
        {
            result[i] = AllowedCharacters[buffer[i] % AllowedCharacters.Length];
        }
        return new string(result);
    }
}
