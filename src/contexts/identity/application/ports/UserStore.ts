import { Role } from '../../domain/Role';

export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  role: Role;
}

export const USER_STORE = Symbol('UserStore');

export interface UserStore {
  findByUsername(username: string): Promise<StoredUser | null>;
  create(user: StoredUser): Promise<void>;
}
