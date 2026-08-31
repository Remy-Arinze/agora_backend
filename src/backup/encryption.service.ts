import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    // Derive a 32-byte key synchronously from the ENCRYPTION_KEY env var
    this.key = crypto.scryptSync(
      process.env.ENCRYPTION_KEY || 'default-key',
      'agora-salt',
      32,
    );
  }

  /**
   * Encrypts a plaintext string using AES-256-GCM.
   * Returns a base64-encoded string containing: [12-byte IV | 16-byte authTag | ciphertext]
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv) as crypto.CipherGCM;

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag(); // 16 bytes by default in GCM mode

    // Layout: [12-byte IV][16-byte authTag][ciphertext]
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  /**
   * Decrypts a base64-encoded string previously produced by `encrypt()`.
   * Expects layout: [12-byte IV][16-byte authTag][ciphertext]
   */
  decrypt(ciphertext: string): string {
    const combined = Buffer.from(ciphertext, 'base64');

    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(12, 28);
    const encrypted = combined.subarray(28);

    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      iv,
    ) as crypto.DecipherGCM;

    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Hashes a password using bcryptjs with salt rounds of 12.
   * Used for MEGA password storage.
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verifies a plaintext password against a bcrypt hash.
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
