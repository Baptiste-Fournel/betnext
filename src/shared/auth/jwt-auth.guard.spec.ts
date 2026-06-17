import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenVerifierPort } from '../../shared-kernel/ports/TokenVerifierPort';

const verifier: TokenVerifierPort = {
  verify: (t: string) => (t === 'good' ? { userId: 'u1', role: 'PLAYER' } : null),
};
const ctxWith = (req: Record<string, unknown>): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;

describe('JwtAuthGuard (BET-20)', () => {
  const guard = new JwtAuthGuard(verifier);

  it('401 sans header Authorization', () => {
    expect(() => guard.canActivate(ctxWith({ headers: {} }))).toThrow(UnauthorizedException);
  });

  it('401 si le schéma n’est pas Bearer', () => {
    expect(() => guard.canActivate(ctxWith({ headers: { authorization: 'Basic abc' } }))).toThrow(
      UnauthorizedException,
    );
  });

  it('401 si le token est invalide', () => {
    expect(() => guard.canActivate(ctxWith({ headers: { authorization: 'Bearer bad' } }))).toThrow(
      UnauthorizedException,
    );
  });

  it('pose req.user et laisse passer un token valide', () => {
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer good' } };
    expect(guard.canActivate(ctxWith(req))).toBe(true);
    expect(req.user).toEqual({ userId: 'u1', role: 'PLAYER' });
  });
});
