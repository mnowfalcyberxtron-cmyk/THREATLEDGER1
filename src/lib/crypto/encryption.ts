import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits auth tag

/**
 * Derives a 32-byte key from APP_ENCRYPTION_KEY or GMAIL_ENCRYPTION_KEY or fallback.
 */
function getMasterKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY || process.env.GMAIL_ENCRYPTION_KEY || 'threatledger_aes256_gcm_master_key_default_fallback_2026';
  
  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }
  
  // Deterministic 32-byte hash
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a sensitive credential (e.g. Gmail App Password) using AES-256-GCM.
 */
export function encryptCredential(plainText: string): {
  encrypted: string;
  iv: string;
  tag: string;
} {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag,
  };
}

/**
 * Decrypt a sensitive credential using AES-256-GCM.
 */
export function decryptCredential(encryptedHex: string, ivHex: string, tagHex: string): string {
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
