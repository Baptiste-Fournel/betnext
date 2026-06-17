import { Role } from '../../domain/Role';

/** Compte stocké. Le mot de passe n'existe QUE sous forme de hash (jamais en clair). */
export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  role: Role;
}

export const USER_STORE = Symbol('UserStore');

export interface UserStore {
  findByUsername(username: string): Promise<StoredUser | null>;
  /** Crée le compte. Doit échouer si le username existe déjà (unicité en base). */
  create(user: StoredUser): Promise<void>;
}
