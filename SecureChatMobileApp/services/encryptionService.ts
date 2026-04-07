import forge from 'node-forge';

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

interface EncryptedMessage {
  /** Wire format from encryptMessage / SignalR */
  ciphertext?: string;
  /** GraphQL field name for the same value (GET_MESSAGES) */
  encryptedContent?: string;
  encryptedKey?: string;
  nonce?: string;
  tag?: string;
  signature?: string;
}

const encodeBase64 = (bytes: string) => forge.util.encode64(bytes);
const decodeBase64 = (value: string) => forge.util.decode64(value);

const readPublicKey = (value: string) => {
  const asn1 = forge.asn1.fromDer(decodeBase64(value));
  return forge.pki.publicKeyFromAsn1(asn1);
};

const readPrivateKey = (value: string) => {
  const asn1 = forge.asn1.fromDer(decodeBase64(value));
  // Support both:
  // - PKCS#1 RSAPrivateKey (preferred; node-forge parses reliably)
  // - PKCS#8 PrivateKeyInfo (legacy values created by earlier code)
  try {
    return forge.pki.privateKeyFromAsn1(asn1); // PKCS#1 path
  } catch {
    const privateKeyInfo = forge.pki.privateKeyInfoFromAsn1(asn1); // PKCS#8 path
    return forge.pki.privateKeyFromAsn1(privateKeyInfo.privateKey);
  }
};

const toPublicKeyPem = (key: any) => encodeBase64(forge.asn1.toDer(forge.pki.publicKeyToAsn1(key)).getBytes());
const toPrivateKeyDer = (key: any) => {
  // Store as PKCS#1 to avoid cross-format parsing issues on decrypt.
  // `readPrivateKey` remains backward compatible with PKCS#8 values.
  const pkcs1 = forge.pki.privateKeyToAsn1(key);
  return encodeBase64(forge.asn1.toDer(pkcs1).getBytes());
};

export const encryptionService = {
  generateSessionKeys(): KeyPair {
    const keyPair = forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 });
    return {
      publicKey: toPublicKeyPem(keyPair.publicKey),
      privateKey: toPrivateKeyDer(keyPair.privateKey)
    };
  },

  encryptMessage(plaintext: string, recipientPublicKey: string, senderPrivateKey?: string): EncryptedMessage {
    if (!plaintext || plaintext.trim().length === 0) {
      throw new Error('Message must contain text before encryption.');
    }

    console.debug('INPUT MESSAGE:', plaintext);

    const aesKey = forge.random.getBytesSync(32);
    const iv = forge.random.getBytesSync(12);
    const cipher = forge.cipher.createCipher('AES-GCM', aesKey);
    cipher.start({ iv, tagLength: 128 });
    cipher.update(forge.util.createBuffer(plaintext, 'utf8'));
    const finished = cipher.finish();
    if (!finished) {
      throw new Error('AES-GCM encryption failed to finish.');
    }

    const ciphertextBytes = cipher.output.getBytes();
    if (!ciphertextBytes || ciphertextBytes.length === 0) {
      throw new Error('Encryption produced an empty ciphertext.');
    }

    const tagBytes = cipher.mode.tag.getBytes();
    if (!tagBytes || tagBytes.length === 0) {
      throw new Error('AES-GCM tag generation failed.');
    }

    const encryptedKey = this.encryptAesKey(recipientPublicKey, aesKey);
    const signature = senderPrivateKey ? this.signMessage(senderPrivateKey, ciphertextBytes) : undefined;

    const ciphertext = encodeBase64(ciphertextBytes);
    const nonce = encodeBase64(iv);
    const tag = encodeBase64(tagBytes);

    console.debug('ENCRYPT RESULT:', { ciphertext, nonce, tag });

    return {
      ciphertext,
      encryptedKey,
      nonce,
      tag,
      signature
    };
  },

  decryptMessage(encrypted: EncryptedMessage, privateKey: string): string {
    const enc = encrypted as EncryptedMessage & Record<string, string | undefined>;
    const ciphertextB64 = enc.ciphertext ?? enc.encryptedContent ?? enc.EncryptedContent;
    const encryptedKeyB64 = enc.encryptedKey ?? enc.EncryptedKey;
    const nonceB64 = enc.nonce ?? enc.Nonce;
    const tagB64 = enc.tag ?? enc.Tag;

    if (
      typeof ciphertextB64 !== 'string' ||
      typeof encryptedKeyB64 !== 'string' ||
      typeof nonceB64 !== 'string' ||
      typeof tagB64 !== 'string'
    ) {
      throw new Error('Missing ciphertext, encryptedKey, nonce, or tag for decryption.');
    }

    const aesKey = this.decryptAesKey(privateKey, encryptedKeyB64);
    const ciphertext = decodeBase64(ciphertextB64);
    const iv = decodeBase64(nonceB64);
    const tag = decodeBase64(tagB64);

    const decipher = forge.cipher.createDecipher('AES-GCM', aesKey);
    decipher.start({ iv, tagLength: 128, tag: forge.util.createBuffer(tag) });
    decipher.update(forge.util.createBuffer(ciphertext));
    const success = decipher.finish();
    if (!success) {
      throw new Error('Unable to decrypt message');
    }

    return decipher.output.toString('utf8');
  },

  encryptAesKey(publicKeyBase64: string, aesKeyBytes: string) {
    const publicKey = readPublicKey(publicKeyBase64);
    const encrypted = publicKey.encrypt(aesKeyBytes, 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: forge.mgf.mgf1.create(forge.md.sha256.create())
    });
    return encodeBase64(encrypted);
  },

  decryptAesKey(privateKeyBase64: string, encryptedKey: string) {
    const privateKey = readPrivateKey(privateKeyBase64);
    return privateKey.decrypt(decodeBase64(encryptedKey), 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: forge.mgf.mgf1.create(forge.md.sha256.create())
    });
  },

  signMessage(privateKeyBase64: string, payload: string) {
    const privateKey = readPrivateKey(privateKeyBase64);
    const md = forge.md.sha256.create();
    // Payload is raw bytes (ciphertext), not UTF-8 text.
    md.update(payload, 'raw');
    const signature = privateKey.sign(md, 'RSASSA-PKCS1-V1_5');
    return encodeBase64(signature);
  },

  verifySignature(publicKeyBase64: string, payload: string, signature: string) {
    const publicKey = readPublicKey(publicKeyBase64);
    const md = forge.md.sha256.create();
    md.update(payload, 'raw');
    return publicKey.verify(md.digest().getBytes(), decodeBase64(signature));
  }
};

export type { EncryptedMessage, KeyPair };
