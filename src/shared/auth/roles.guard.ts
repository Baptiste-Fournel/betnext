import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthRole } from '../../shared-kernel/ports/TokenVerifierPort';
import { AuthUser } from './auth-user';
import { ROLES_KEY } from './roles.decorator';

interface RequestWithUser {
  user?: AuthUser;
}

/**
 * Autorisation par rôle. À utiliser APRÈS JwtAuthGuard (qui pose `req.user`). Si l'endpoint déclare
 * des rôles via @Roles et que l'utilisateur ne les a pas → 403. Sans @Roles → laisse passer.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AuthRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const user = context.switchToHttp().getRequest<RequestWithUser>().user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Rôle non autorisé');
    }
    return true;
  }
}
