import crypto from 'crypto';
import { EncryptedSpecs } from '../types.js';

export function encryptSpecs(keyHex: string, plaintext: string): EncryptedSpecs {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext,
    iv: iv.toString('hex'),
    authTag,
  };
}

export function decryptSpecs(keyHex: string, encrypted: EncryptedSpecs): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(encrypted.iv, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));

  let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}

/**
 * Returns the JavaScript code snippet that decrypts specs at runtime
 * inside the WebContainer's run-tests.js.
 */
export function getDecryptionSnippet(): string {
  return `
function decryptSpecs(keyHex, encrypted) {
  var crypto = require('crypto');
  var key = Buffer.from(keyHex, 'hex');
  var iv = Buffer.from(encrypted.iv, 'hex');
  var decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));
  var plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}
`.trim();
}
