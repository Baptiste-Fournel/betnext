import { Global, Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

/**
 * Plomberie d'auth HTTP PARTAGÉE (pas un bounded context) : expose les guards en GLOBAL pour que
 * n'importe quel contrôleur les applique via @UseGuards SANS importer l'intérieur d'Identity. Les
 * guards ne dépendent que du port partagé TOKEN_VERIFIER (implémenté par Identity).
 */
@Global()
@Module({
  providers: [JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
