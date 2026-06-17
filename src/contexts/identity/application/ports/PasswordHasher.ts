export const PASSWORD_HASHER = Symbol('PasswordHasher');

/** Hachage de mot de passe (jamais de stockage en clair). `verify` doit être à temps constant. */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}
