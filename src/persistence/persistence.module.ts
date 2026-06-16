import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionContext } from './TransactionContext';
import { BetRecord } from '../contexts/betting/infrastructure/persistence/BetRecord';
import { BetEventRecord } from '../contexts/betting/infrastructure/persistence/BetEventRecord';
import { OutboxRecord } from '../contexts/betting/infrastructure/persistence/OutboxRecord';
import { IdempotencyKeyRecord } from '../contexts/betting/infrastructure/persistence/IdempotencyKeyRecord';
import { WalletRecord } from '../contexts/wallet/infrastructure/persistence/WalletRecord';
import { WalletOperationRecord } from '../contexts/wallet/infrastructure/persistence/WalletOperationRecord';
import { ProcessedMessageRecord } from '../messaging/ProcessedMessageRecord';
import { InitBetting1718200000000 } from '../contexts/betting/infrastructure/persistence/migrations/1718200000000-InitBetting';
import { InitWallet1718300000000 } from '../contexts/wallet/infrastructure/persistence/migrations/1718300000000-InitWallet';
import { InitOutbox1718400000000 } from '../contexts/betting/infrastructure/persistence/migrations/1718400000000-InitOutbox';
import { InitProcessedMessages1718500000000 } from '../messaging/migrations/1718500000000-InitProcessedMessages';
import { InitIdempotencyKeys1718600000000 } from '../contexts/betting/infrastructure/persistence/migrations/1718600000000-InitIdempotencyKeys';
import { InitWalletOperations1718700000000 } from '../contexts/wallet/infrastructure/persistence/migrations/1718700000000-InitWalletOperations';
import { InitBetSettlementGuard1718800000000 } from '../contexts/betting/infrastructure/persistence/migrations/1718800000000-InitBetSettlementGuard';
import { InitCompliance1718900000000 } from '../contexts/compliance/infrastructure/persistence/migrations/1718900000000-InitCompliance';

const ENTITIES = [
  BetRecord,
  BetEventRecord,
  OutboxRecord,
  IdempotencyKeyRecord,
  WalletRecord,
  WalletOperationRecord,
  ProcessedMessageRecord,
];
const MIGRATIONS = [
  InitBetting1718200000000,
  InitWallet1718300000000,
  InitOutbox1718400000000,
  InitProcessedMessages1718500000000,
  InitIdempotencyKeys1718600000000,
  InitWalletOperations1718700000000,
  InitBetSettlementGuard1718800000000,
  InitCompliance1718900000000,
];

/**
 * Connexion persistance + couture transactionnelle (TransactionContext GLOBAL, instance unique).
 * DATABASE_URL défini → TypeORM/Postgres (migrations idempotentes au boot) ; sinon → adapters en
 * mémoire. DATABASE_URL non codé en dur.
 */
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
        }),
      ],
      providers: [TransactionContext],
      exports: [TransactionContext, TypeOrmModule],
    };
  }
}
