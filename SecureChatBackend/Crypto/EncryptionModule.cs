using System;
using System.Security.Cryptography;
using System.Text;

namespace SecureChatBackend.Crypto;

public static class EncryptionModule
{
    public const int RsaKeySize = 4096;

    public static (string publicKey, string privateKey) GenerateRsaKeyPair()
    {
        using var rsa = RSA.Create(RsaKeySize);
        var publicKey = Convert.ToBase64String(rsa.ExportSubjectPublicKeyInfo());
        var privateKey = Convert.ToBase64String(rsa.ExportPkcs8PrivateKey());
        return (publicKey, privateKey);
    }

    public static byte[] GenerateAesKey(int keySize = 32)
    {
        return RandomNumberGenerator.GetBytes(keySize);
    }

    public static EncryptedPayload EncryptPayload(string plaintext, byte[] aesKey)
    {
        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var nonce = RandomNumberGenerator.GetBytes(12);
        var tag = new byte[16];
        var ciphertext = new byte[plaintextBytes.Length];

        #pragma warning disable SYSLIB0053
        using (var aes = new AesGcm(aesKey))
        #pragma warning restore SYSLIB0053
        {
            aes.Encrypt(nonce, plaintextBytes, ciphertext, tag);
        }

        return new EncryptedPayload
        {
            Ciphertext = Convert.ToBase64String(ciphertext),
            Nonce = Convert.ToBase64String(nonce),
            Tag = Convert.ToBase64String(tag)
        };
    }

    public static string DecryptPayload(EncryptedPayload payload, byte[] aesKey)
    {
        var ciphertext = Convert.FromBase64String(payload.Ciphertext);
        var nonce = Convert.FromBase64String(payload.Nonce);
        var tag = Convert.FromBase64String(payload.Tag);
        var plaintext = new byte[ciphertext.Length];

        #pragma warning disable SYSLIB0053
        using (var aes = new AesGcm(aesKey))
        #pragma warning restore SYSLIB0053
        {
            aes.Decrypt(nonce, ciphertext, tag, plaintext);
        }

        return Encoding.UTF8.GetString(plaintext);
    }

    public static string EncryptAesKey(string publicKeyBase64, byte[] aesKey)
    {
        using var rsa = RSA.Create();
        var publicKey = Convert.FromBase64String(publicKeyBase64);
        rsa.ImportSubjectPublicKeyInfo(publicKey, out _);
        var encrypted = rsa.Encrypt(aesKey, RSAEncryptionPadding.OaepSHA256);
        return Convert.ToBase64String(encrypted);
    }

    public static byte[] DecryptAesKey(string privateKeyBase64, string encryptedKeyBase64)
    {
        using var rsa = RSA.Create();
        var privateKey = Convert.FromBase64String(privateKeyBase64);
        rsa.ImportPkcs8PrivateKey(privateKey, out _);
        return rsa.Decrypt(Convert.FromBase64String(encryptedKeyBase64), RSAEncryptionPadding.OaepSHA256);
    }

    public static string SignMessage(string privateKeyBase64, string message)
    {
        using var rsa = RSA.Create();
        var privateKey = Convert.FromBase64String(privateKeyBase64);
        rsa.ImportPkcs8PrivateKey(privateKey, out _);
        var data = Encoding.UTF8.GetBytes(message);
        var signature = rsa.SignData(data, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        return Convert.ToBase64String(signature);
    }

    public static bool VerifySignature(string publicKeyBase64, string message, string signatureBase64)
    {
        using var rsa = RSA.Create();
        var publicKey = Convert.FromBase64String(publicKeyBase64);
        rsa.ImportSubjectPublicKeyInfo(publicKey, out _);
        var data = Encoding.UTF8.GetBytes(message);
        return rsa.VerifyData(data, Convert.FromBase64String(signatureBase64), HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
    }

    public static (string publicKey, string privateKey) RotateKeyPair(string currentPrivateKey)
    {
        // clients can keep using old private key until server coordinates the new public key
        return GenerateRsaKeyPair();
    }
}
