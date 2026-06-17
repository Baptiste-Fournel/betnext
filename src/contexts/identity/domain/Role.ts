import { AuthRole } from '../../../shared-kernel/ports/TokenVerifierPort';

export type Role = AuthRole;

export const ROLES: readonly Role[] = ['PLAYER', 'MANAGER'];

export const isRole = (value: unknown): value is Role => value === 'PLAYER' || value === 'MANAGER';
