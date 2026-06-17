import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from './auth-user';

interface RequestWithUser {
  user?: AuthUser;
}

/** Injecte l'utilisateur authentifié (posé par JwtAuthGuard) dans un paramètre de handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest<RequestWithUser>().user,
);
