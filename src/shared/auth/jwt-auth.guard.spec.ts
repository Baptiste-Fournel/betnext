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

  it('shouldThrowUnauthorized_WhenAuthorizationHeaderMissing', () => {
    // When / Then
    expect(() => guard.canActivate(ctxWith({ headers: {} }))).toThrow(UnauthorizedException);
  });

  it('shouldThrowUnauthorized_WhenSchemeNotBearer', () => {
    // When / Then
    expect(() => guard.canActivate(ctxWith({ headers: { authorization: 'Basic abc' } }))).toThrow(
      UnauthorizedException,
    );
  });

  it('shouldThrowUnauthorized_WhenTokenInvalid', () => {
    // When / Then
    expect(() => guard.canActivate(ctxWith({ headers: { authorization: 'Bearer bad' } }))).toThrow(
      UnauthorizedException,
    );
  });

  it('shouldSetReqUserAndAllow_WhenTokenValid', () => {
    // Given
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer good' } };

    // When / Then
    expect(guard.canActivate(ctxWith(req))).toBe(true);
    expect(req.user).toEqual({ userId: 'u1', role: 'PLAYER' });
  });
});
