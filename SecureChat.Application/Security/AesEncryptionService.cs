using System.Security.Cryptography;
using System.Text;

namespace SecureChat.Application.Security;

public interface IAesEncryptionService
{
    string Encrypt(string plaintext, string key);
}

public class AesEncryptionService : IAesEncryptionService
{
    public string Encrypt(string plaintext, string key)
    {
        ArgumentNullException.ThrowIfNull(plaintext);
        ArgumentNullException.ThrowIfNull(key);

        using var aes = Aes.Create();
        aes.Key = Encoding.UTF8.GetBytes(key);

        // Random IV per message; prepend IV to ciphertext (both Base64-encoded).
        aes.GenerateIV();
        var iv = aes.IV;

        using var encryptor = aes.CreateEncryptor(aes.Key, iv);
        var plainBytes = Encoding.UTF8.GetBytes(plaintext);
        var cipherBytes = encryptor.TransformFinalBlock(plainBytes, 0, plainBytes.Length);

        var combined = new byte[iv.Length + cipherBytes.Length];
        Buffer.BlockCopy(iv, 0, combined, 0, iv.Length);
        Buffer.BlockCopy(cipherBytes, 0, combined, iv.Length, cipherBytes.Length);

        return Convert.ToBase64String(combined);
    }
}

