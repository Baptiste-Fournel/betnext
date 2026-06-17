import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PasswordHasher } from '../application/ports/PasswordHasher';

const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;
const SALT_LEN = 16;

/**
 * Hachage de mot de passe via `scrypt` (Node natif, recommandé OWASP — pas de dépendance externe).
 * Format stocké : `scrypt$<saltHex>$<hashHex>`. `verify` à temps constant (`timingSafeEqual`).
 * Le mot de passe en clair n'est jamais conservé ni journalisé.
 */
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(SALT_LEN);
    const derived = (await scryptAsync(plain, salt, KEY_LEN)) as Buffer;
    return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
  }

  async verify(plain: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt' || !parts[1] || !parts[2]) {
      return false;
    }
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    if (salt.length === 0 || expected.length === 0) {
      // Hash stocké dégénéré (hex invalide / vide) → refus systématique (sinon `timingSafeEqual`
      // sur deux buffers vides renverrait true et accepterait n'importe quel mot de passe).
      return false;
    }
    const derived = (await scryptAsync(plain, salt, expected.length)) as Buffer;
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  }
}
