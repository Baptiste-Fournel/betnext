import { Role } from '../../domain/Role';

export const TOKEN_SERVICE = Symbol('TokenService');

export interface IssuedToken {
  token: string;
  expiresInSec: number;
}

export interface TokenService {
  sign(input: { userId: string; role: Role }): IssuedToken;
}
