import { AuthRole } from '../../../shared-kernel/ports/TokenVerifierPort';

/** Rôle d'un compte. Aligné sur le contrat partagé `AuthRole` (PLAYER | MANAGER). */
export type Role = AuthRole;

export const ROLES: readonly Role[] = ['PLAYER', 'MANAGER'];

export const isRole = (value: unknown): value is Role => value === 'PLAYER' || value === 'MANAGER';
