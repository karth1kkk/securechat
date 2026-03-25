namespace SecureChatBackend.Crypto;

public sealed class EncryptedPayload
{
    public string Ciphertext { get; set; } = null!;
    public string Nonce { get; set; } = null!;
    public string Tag { get; set; } = null!;
}
