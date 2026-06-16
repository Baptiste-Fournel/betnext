import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionContext } from './TransactionContext';
import { ENTITIES, MIGRATIONS } from './schema';

const DEFAULT_POOL_SIZE = 10;

/**
 * Connexion persistance + couture transactionnelle (TransactionContext GLOBAL, instance unique).
 * Postgres est le store **par défaut** de l'app qui tourne : `main.ts` REFUSE de démarrer sans
 * `DATABASE_URL` (le fallback en mémoire ci-dessous est réservé aux TESTS et à la génération du
 * contrat OpenAPI, qui bootent `AppModule` directement). Schéma = SOURCE UNIQUE `schema.ts`.
 * Migrations jouées au boot (`migrationsRun`), jamais de `synchronize`. Pool configurable (`DB_POOL_SIZE`).
 */
@Module({})
export class PersistenceModule {
  static forRoot(): DynamicModule {
    const url = process.env.DATABASE_URL;
    if (!url) {
      // Mode en mémoire : tests / génération de contrat uniquement (l'app réelle exige Postgres).
      return {
        module: PersistenceModule,
        global: true,
        providers: [TransactionContext],
        exports: [TransactionContext],
      };
    }
    const requested = Number(process.env.DB_POOL_SIZE ?? DEFAULT_POOL_SIZE);
    const poolSize = Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_POOL_SIZE;
    return {
      module: PersistenceModule,
      global: true,
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url,
          entities: ENTITIES,
          migrations: MIGRATIONS,
          migrationsRun: true,
          synchronize: false,
          poolSize,
        }),
      ],
      providers: [TransactionContext],
      exports: [TransactionContext, TypeOrmModule],
    };
  }
}
