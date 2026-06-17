import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TOKEN_VERIFIER, TokenVerifierPort } from '../../shared-kernel/ports/TokenVerifierPort';
import { AuthUser } from './auth-user';

interface MutableRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_VERIFIER) private readonly tokens: TokenVerifierPort) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<MutableRequest>();
    const header = req.headers?.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    const [scheme, token] = (value ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token Bearer requis');
    }
    const verified = this.tokens.verify(token);
    if (!verified) {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
    req.user = { userId: verified.userId, role: verified.role };
    return true;
  }
}
