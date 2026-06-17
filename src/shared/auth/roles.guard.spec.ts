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
  it('laisse passer si aucun rôle requis', () => {
    expect(guardRequiring(undefined).canActivate(ctxWith({ userId: 'u1', role: 'PLAYER' }))).toBe(
      true,
    );
  });

  it('403 si le rôle ne correspond pas (joueur sur endpoint gestionnaire)', () => {
    expect(() =>
      guardRequiring(['MANAGER']).canActivate(ctxWith({ userId: 'u1', role: 'PLAYER' })),
    ).toThrow(ForbiddenException);
  });

  it('laisse passer le bon rôle', () => {
    expect(
      guardRequiring(['MANAGER']).canActivate(ctxWith({ userId: 'm1', role: 'MANAGER' })),
    ).toBe(true);
  });

  it('403 si un rôle est requis mais l’utilisateur est absent', () => {
    expect(() => guardRequiring(['PLAYER']).canActivate(ctxWith(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
