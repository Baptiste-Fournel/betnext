import { randomBytes, randomUUID } from 'node:crypto';
import { Global, Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TOKEN_VERIFIER } from '../../shared-kernel/ports/TokenVerifierPort';
import { USER_STORE, UserStore } from './application/ports/UserStore';
import { PASSWORD_HASHER, PasswordHasher } from './application/ports/PasswordHasher';
import { TOKEN_SERVICE, TokenService } from './application/ports/TokenService';
import { ID_GENERATOR, IdGenerator } from './application/ports/IdGenerator';
import { RegisterUser } from './application/RegisterUser';
import { LoginUser } from './application/LoginUser';
import { ScryptPasswordHasher } from './infrastructure/ScryptPasswordHasher';
import { HmacTokenService } from './infrastructure/HmacTokenService';
import { InMemoryUserStore } from './infrastructure/InMemoryUserStore';
import { TypeOrmUserStore } from './infrastructure/persistence/TypeOrmUserStore';
import { AuthController } from './infrastructure/http/AuthController';

/**
 * Contexte Identity (BET-20). Expose en GLOBAL le port partagé TOKEN_VERIFIER (le guard HTTP le
 * consomme sans importer l'intérieur d'Identity → frontières propres). Postgres si DATABASE_URL,
 * sinon en mémoire. Le secret de signature vient de l'ENV (`AUTH_SECRET`) ; en mode tests/contrat
 * (sans ENV) un secret éphémère aléatoire est généré au boot (jamais de secret en dur dans le repo).
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [
    { provide: ID_GENERATOR, useFactory: (): IdGenerator => ({ next: () => randomUUID() }) },
    { provide: PASSWORD_HASHER, useFactory: (): PasswordHasher => new ScryptPasswordHasher() },
    {
      provide: USER_STORE,
      useFactory: (dataSource?: DataSource): UserStore =>
        dataSource ? new TypeOrmUserStore(dataSource) : new InMemoryUserStore(),
      inject: [{ token: getDataSourceToken(), optional: true }],
    },
    {
      // Une seule instance HMAC sert l'émission (TOKEN_SERVICE) ET la vérification (TOKEN_VERIFIER).
      provide: TOKEN_SERVICE,
      useFactory: (): HmacTokenService =>
        new HmacTokenService(process.env.AUTH_SECRET ?? randomBytes(32).toString('hex')),
    },
    { provide: TOKEN_VERIFIER, useExisting: TOKEN_SERVICE },
    {
      provide: RegisterUser,
      useFactory: (users: UserStore, hasher: PasswordHasher, ids: IdGenerator): RegisterUser =>
        new RegisterUser(users, hasher, ids),
      inject: [USER_STORE, PASSWORD_HASHER, ID_GENERATOR],
    },
    {
      provide: LoginUser,
      useFactory: (users: UserStore, hasher: PasswordHasher, tokens: TokenService): LoginUser =>
        new LoginUser(users, hasher, tokens),
      inject: [USER_STORE, PASSWORD_HASHER, TOKEN_SERVICE],
    },
  ],
  exports: [TOKEN_VERIFIER],
})
export class IdentityModule {}
