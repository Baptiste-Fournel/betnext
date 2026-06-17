import { AuthRole } from '../../shared-kernel/ports/TokenVerifierPort';

/** Utilisateur authentifié, posé sur la requête par le guard et lu via @CurrentUser. */
export interface AuthUser {
  userId: string;
  role: AuthRole;
}
