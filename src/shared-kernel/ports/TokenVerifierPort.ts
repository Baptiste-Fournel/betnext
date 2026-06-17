export const TOKEN_VERIFIER = Symbol('TokenVerifier');

export type AuthRole = 'PLAYER' | 'MANAGER';

export interface VerifiedToken {
  userId: string;
  role: AuthRole;
}

export interface TokenVerifierPort {
  verify(token: string): VerifiedToken | null;
}
