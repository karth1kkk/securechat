namespace SecureChatBackend.Auth;

public sealed class JwtSettings
{
    public string Issuer { get; set; } = "SecureChatBackend";
    public string Audience { get; set; } = "SecureChatClients";
    public string Secret { get; set; } = null!;
    public int TokenLifetimeMinutes { get; set; } = 10080; // 7 days
}
