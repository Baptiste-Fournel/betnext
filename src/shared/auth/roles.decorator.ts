import { SetMetadata } from '@nestjs/common';
import { AuthRole } from '../../shared-kernel/ports/TokenVerifierPort';

export const ROLES_KEY = 'roles';

/** Restreint un endpoint à un/des rôle(s). Vérifié par RolesGuard (après JwtAuthGuard). */
export const Roles = (...roles: AuthRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
