import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BetRecord } from '../contexts/betting/infrastructure/persistence/BetRecord';
import { BetEventRecord } from '../contexts/betting/infrastructure/persistence/BetEventRecord';
import { InitBetting1718200000000 } from '../contexts/betting/infrastructure/persistence/migrations/1718200000000-InitBetting';

/**
 * Connexion persistance. DATABASE_URL défini → TypeORM/Postgres (migrations jouées au boot,
 * idempotentes). Sinon → aucune connexion : l'app retombe sur l'adapter en mémoire, et reste
 * lançable/testable sans DB. DATABASE_URL n'est PAS codé en dur.
 */
@Module({})
export class PersistenceModule {
  static forRoot(): DynamicModule {
    const url = process.env.DATABASE_URL;
    if (!url) {
      return { module: PersistenceModule };
    }
    return {
      module: PersistenceModule,
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url,
          entities: [BetRecord, BetEventRecord],
          migrations: [InitBetting1718200000000],
          migrationsRun: true,
          synchronize: false,
        }),
      ],
      exports: [TypeOrmModule],
    };
  }
}
