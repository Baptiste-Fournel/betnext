/**
 * Contrat PARTAGÉ (Shared Kernel) de vérification de token. Le guard HTTP (src/shared/auth) le
 * consomme pour authentifier au BORD ; le contexte Identity en fournit l'implémentation (HMAC).
 * Aucun autre contexte n'importe l'intérieur d'Identity : il ne dépend que de ce contrat.
 */
export const TOKEN_VERIFIER = Symbol('TokenVerifier');

export type AuthRole = 'PLAYER' | 'MANAGER';

export interface VerifiedToken {
  userId: string;
  role: AuthRole;
}

export interface TokenVerifierPort {
  /** Retourne le contenu vérifié du token, ou null si invalide/expiré (jamais d'exception). */
  verify(token: string): VerifiedToken | null;
}
