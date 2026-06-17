import 'reflect-metadata';
import { RequestMethod, Type } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from './shared/auth/jwt-auth.guard';
import { HealthController } from './health/HealthController';
import { OddsReadController } from './read-model/OddsReadController';
import { OddsStreamController } from './read-model/OddsStreamController';
import { AuthController } from './contexts/identity/infrastructure/http/AuthController';
import { BettingController } from './contexts/betting/infrastructure/http/BettingController';
import { SettlementController } from './contexts/betting/infrastructure/http/SettlementController';
import { CatalogController } from './contexts/catalog/infrastructure/http/CatalogController';
import { ComplianceController } from './contexts/compliance/infrastructure/http/ComplianceController';
import { WalletController } from './contexts/wallet/infrastructure/http/WalletController';
import { ReconciliationController } from './contexts/wallet/infrastructure/http/ReconciliationController';

const CONTROLLERS: Type[] = [
  HealthController,
  OddsReadController,
  OddsStreamController,
  AuthController,
  BettingController,
  SettlementController,
  CatalogController,
  ComplianceController,
  WalletController,
  ReconciliationController,
];

const PUBLIC_ALLOWLIST = new Set<string>([
  'GET /health',
  'GET /odds/:outcomeId',
  'GET /streams/odds',
  'POST /auth/register',
  'POST /auth/login',
  'GET /markets',
]);

interface RouteInfo {
  key: string;
  hasJwtGuard: boolean;
}

const normalizePath = (raw: string): string =>
  `/${raw}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');

function routesOf(controller: Type): RouteInfo[] {
  const base = (Reflect.getMetadata(PATH_METADATA, controller) as string | undefined) ?? '';
  const classGuards =
    (Reflect.getMetadata(GUARDS_METADATA, controller) as unknown[] | undefined) ?? [];
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor' && typeof proto[name] === 'function')
    .map((name) => proto[name] as object)
    .filter((handler) => Reflect.hasMetadata(METHOD_METADATA, handler))
    .map((handler) => {
      const sub = (Reflect.getMetadata(PATH_METADATA, handler) as string | undefined) ?? '';
      const verb = Reflect.getMetadata(METHOD_METADATA, handler) as number;
      const methodGuards =
        (Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[] | undefined) ?? [];
      const guards = [...classGuards, ...methodGuards];
      const path = normalizePath([base, sub].filter(Boolean).join('/'));
      return { key: `${RequestMethod[verb]} ${path}`, hasJwtGuard: guards.includes(JwtAuthGuard) };
    });
}

describe('Couverture des guards (BET-20)', () => {
  const routes = CONTROLLERS.flatMap(routesOf);

  it('shouldDiscoverAllRoutes_WhenInspectingControllers', () => {
    // Act / Assert
    expect(routes.length).toBeGreaterThanOrEqual(15);
  });

  it('shouldCarryJwtAuthGuard_WhenEndpointNotPublic', () => {
    // Act
    const unprotected = routes
      .filter((r) => !PUBLIC_ALLOWLIST.has(r.key) && !r.hasJwtGuard)
      .map((r) => r.key);

    // Assert
    expect(unprotected).toEqual([]);
  });

  it('shouldHaveNoDeadEntries_WhenCheckingPublicAllowlistAgainstRoutes', () => {
    // Act
    const keys = new Set(routes.map((r) => r.key));

    // Assert
    expect([...PUBLIC_ALLOWLIST].filter((k) => !keys.has(k))).toEqual([]);
  });
});
