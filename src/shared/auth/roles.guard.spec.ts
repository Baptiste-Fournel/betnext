import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { AuthRole } from '../../shared-kernel/ports/TokenVerifierPort';
import { AuthUser } from './auth-user';

const ctxWith = (user: AuthUser | undefined): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

const guardRequiring = (roles: AuthRole[] | undefined): RolesGuard => {
  const reflector = {
    getAllAndOverride: (): AuthRole[] | undefined => roles,
  } as unknown as Reflector;
  return new RolesGuard(reflector);
};

describe('RolesGuard (BET-20)', () => {
  it('shouldAllow_WhenNoRoleRequired', () => {
    // When / Then
    expect(guardRequiring(undefined).canActivate(ctxWith({ userId: 'u1', role: 'PLAYER' }))).toBe(
      true,
    );
  });

  it('shouldThrowForbidden_WhenPlayerHitsManagerOnlyEndpoint', () => {
    // When / Then
    expect(() =>
      guardRequiring(['MANAGER']).canActivate(ctxWith({ userId: 'u1', role: 'PLAYER' })),
    ).toThrow(ForbiddenException);
  });

  it('shouldAllow_WhenRoleMatchesRequired', () => {
    // When / Then
    expect(
      guardRequiring(['MANAGER']).canActivate(ctxWith({ userId: 'm1', role: 'MANAGER' })),
    ).toBe(true);
  });

  it('shouldThrowForbidden_WhenRoleRequiredButUserAbsent', () => {
    // When / Then
    expect(() => guardRequiring(['PLAYER']).canActivate(ctxWith(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
