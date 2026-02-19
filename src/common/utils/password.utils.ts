import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';

/**
 * Generates a cryptographically secure random password.
 * The password includes uppercase, lowercase, numbers, and special characters.
 *
 * @param length - Password length (default: 16)
 * @returns A random password string
 */
export function generateSecurePassword(length: number = 16): string {
  // Character sets for password generation
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed I and O to avoid confusion
  const lowercase = 'abcdefghjkmnpqrstuvwxyz'; // Removed i, l, o to avoid confusion
  const numbers = '23456789'; // Removed 0 and 1 to avoid confusion
  const special = '!@#$%^&*';

  const allChars = uppercase + lowercase + numbers + special;

  // Generate random bytes
  const bytes = randomBytes(length);

  // Build password ensuring at least one of each type
  let password = '';

  // Ensure at least one of each required character type
  password += uppercase[bytes[0] % uppercase.length];
  password += lowercase[bytes[1] % lowercase.length];
  password += numbers[bytes[2] % numbers.length];
  password += special[bytes[3] % special.length];

  // Fill the rest with random characters
  for (let i = 4; i < length; i++) {
    password += allChars[bytes[i] % allChars.length];
  }

  // Shuffle the password to randomize position of guaranteed characters
  const shuffled = password.split('');
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = bytes[i % bytes.length] % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.join('');
}

/**
 * Generates a secure random password and returns its bcrypt hash.
 *
 * @param length - Password length (default: 16)
 * @param saltRounds - bcrypt salt rounds (default: 10)
 * @returns Promise resolving to the bcrypt hash of the generated password
 */
export async function generateSecurePasswordHash(
  length: number = 16,
  saltRounds: number = 10
): Promise<string> {
  const password = generateSecurePassword(length);
  return bcrypt.hash(password, saltRounds);
}
