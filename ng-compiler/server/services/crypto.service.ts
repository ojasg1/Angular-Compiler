import crypto from 'crypto';

// --- Legacy HMAC functions (kept for backward compat) ---

export function generateNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateHmacKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function computeHmac(key: string, payload: string): string {
  return crypto.createHmac('sha256', key).update(payload).digest('hex');
}

export function verifyHmac(key: string, payload: string, signature: string): boolean {
  const expected = computeHmac(key, payload);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
}

export function generateSessionId(): string {
  return crypto.randomUUID();
}

// --- Ed25519 Asymmetric Signing ---

export interface KeyPair {
  publicKey: string;  // PEM-encoded
  privateKey: string; // PEM-encoded
}

export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

export function signPayload(privateKeyPem: string, payload: string): string {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(payload), privateKey);
  return signature.toString('hex');
}

export function verifySignature(publicKeyPem: string, payload: string, signatureHex: string): boolean {
  try {
    const publicKey = crypto.createPublicKey(publicKeyPem);
    return crypto.verify(null, Buffer.from(payload), publicKey, Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}

// --- AES-256-GCM Encryption for test specs ---

export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
