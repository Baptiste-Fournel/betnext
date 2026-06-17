import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionContext } from './TransactionContext';
import { ENTITIES, MIGRATIONS } from './schema';

const DEFAULT_POOL_SIZE = 10;

@Module({})
export class PersistenceModule {
  static forRoot(): DynamicModule {
    const url = process.env.DATABASE_URL;
    if (!url) {
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
