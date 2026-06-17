import { SetMetadata } from '@nestjs/common';
import { AuthRole } from '../../shared-kernel/ports/TokenVerifierPort';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: AuthRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
