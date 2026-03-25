import forge from 'node-forge';

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

interface EncryptedMessage {
  ciphertext: string;
  encryptedKey: string;
  nonce: string;
  tag: string;
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
  return forge.pki.privateKeyFromAsn1(asn1);
};

const toPublicKeyPem = (key: forge.pki.rsa.PublicKey) => encodeBase64(forge.asn1.toDer(forge.pki.publicKeyToAsn1(key)).getBytes());
const toPrivateKeyDer = (key: forge.pki.rsa.PrivateKey) => {
  const pkcs1 = forge.pki.privateKeyToAsn1(key);
  const pkcs8 = forge.pki.wrapRsaPrivateKey(pkcs1);
  return encodeBase64(forge.asn1.toDer(pkcs8).getBytes());
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
    const aesKey = forge.random.getBytesSync(32);
    const iv = forge.random.getBytesSync(12);
    const cipher = forge.cipher.createCipher('AES-GCM', aesKey);
    cipher.start({ iv, tagLength: 128 });
    cipher.update(forge.util.createBuffer(plaintext, 'utf8'));
    cipher.finish();

    const encryptedKey = this.encryptAesKey(recipientPublicKey, aesKey);
    const signature = senderPrivateKey ? this.signMessage(senderPrivateKey, cipher.output.getBytes()) : undefined;

    return {
      ciphertext: encodeBase64(cipher.output.getBytes()),
      encryptedKey,
      nonce: encodeBase64(iv),
      tag: encodeBase64(cipher.mode.tag.getBytes()),
      signature
    };
  },

  decryptMessage(encrypted: EncryptedMessage, privateKey: string): string {
    const aesKey = this.decryptAesKey(privateKey, encrypted.encryptedKey);
    const ciphertext = decodeBase64(encrypted.ciphertext);
    const iv = decodeBase64(encrypted.nonce);
    const tag = decodeBase64(encrypted.tag);

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
    md.update(payload, 'utf8');
    const signature = privateKey.sign(md, 'RSASSA-PKCS1-V1_5');
    return encodeBase64(signature);
  },

  verifySignature(publicKeyBase64: string, payload: string, signature: string) {
    const publicKey = readPublicKey(publicKeyBase64);
    const md = forge.md.sha256.create();
    md.update(payload, 'utf8');
    return publicKey.verify(md.digest().getBytes(), decodeBase64(signature));
  }
};

export type { EncryptedMessage, KeyPair };
