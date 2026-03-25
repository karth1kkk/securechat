# End-to-End Encryption Guide

This module demonstrates how to keep the SecureChat messaging flow end-to-end encrypted.
The backend stores only encrypted blobs while the clients hold the private material.

## Key Flow
1. Each device runs `EncryptionModule.GenerateRsaKeyPair()` and keeps the private key locally.
2. The public key is sent to the backend once per user/device (stored in the `User.PublicKey`).
3. To send a message:
   * Generate a temporary AES key with `GenerateAesKey()`.
   * Encrypt the plaintext with `EncryptPayload(...)` to get ciphertext + nonce/tag.
   * Encrypt the AES key with the recipient's public key via `EncryptAesKey(...)`.
   * Optionally sign the ciphertext using `SignMessage(privateKey, ciphertext)`.
   * Deliver `ciphertext`, `nonce`, `tag`, `encryptedKey`, and `signature` to the backend (stored inside `Message`).
4. The recipient fetches the ciphertext bundle (plus `EncryptedKey`) and decrypts locally:
   * Decrypt AES key with `DecryptAesKey(...)` using the private key.
   * Decrypt the ciphertext with `DecryptPayload(...)`.
   * If signing is used, validate sender identity with `VerifySignature(...)`.

## Rotation & Signing
* A device can rotate its RSA pair by calling `RotateKeyPair(...)`; a background sync pushes the new public key to the server when ready, while queued messages can still be decrypted with the older private key until the rotation completes.
* `SignMessage(...)`/`VerifySignature(...)` add integrity and proof of origin. Store the signature alongside the encrypted bundle and surface it to clients so they can call `VerifySignature(senderPublicKey, ciphertext, signature)` before decryption.

## Serialization
The backend currently persists `ciphertext`, `encryptedKey`, `nonce`, `tag`, and `signature`. Clients may serialize these fields into the `SendMessageInput` GraphQL mutation and bundle them in their own wire format (e.g., base64 JSON or a compact binary/) so that no plaintext or symmetric keys ever traverse the server.

This module is intended to be reused by any .NET-based client or service that needs deterministic AES/RSA logistics. For browser or mobile environments, port the logic to `libsodium.js`, `crypto.subtle`, or equivalent libraries while mirroring the same parameter sizes (256-bit AES, 4096-bit RSA, 12-byte AES-GCM nonce).
