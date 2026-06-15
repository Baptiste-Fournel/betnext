import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionContext } from './TransactionContext';
import { BetRecord } from '../contexts/betting/infrastructure/persistence/BetRecord';
import { BetEventRecord } from '../contexts/betting/infrastructure/persistence/BetEventRecord';
import { OutboxRecord } from '../contexts/betting/infrastructure/persistence/OutboxRecord';
import { ProcessedMessageRecord } from '../messaging/ProcessedMessageRecord';
import { WalletRecord } from '../contexts/wallet/infrastructure/persistence/WalletRecord';
import { InitBetting1718200000000 } from '../contexts/betting/infrastructure/persistence/migrations/1718200000000-InitBetting';
import { InitWallet1718300000000 } from '../contexts/wallet/infrastructure/persistence/migrations/1718300000000-InitWallet';
import { InitOutbox1718400000000 } from '../contexts/betting/infrastructure/persistence/migrations/1718400000000-InitOutbox';
import { InitProcessedMessages1718500000000 } from '../messaging/migrations/1718500000000-InitProcessedMessages';

/**
 * Connexion persistance + couture transactionnelle. `TransactionContext` est fourni en GLOBAL
 * (une seule instance partagée par les repositories Betting et l'adapter Wallet → ils rejoignent
 * la MÊME transaction, condition de l'atomicité BET-5). DATABASE_URL défini → TypeORM/Postgres
 * (migrations idempotentes au boot) ; sinon → adapters en mémoire. DATABASE_URL non codé en dur.
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
          entities: [BetRecord, BetEventRecord, WalletRecord, OutboxRecord, ProcessedMessageRecord],
          migrations: [
            InitBetting1718200000000,
            InitWallet1718300000000,
            InitOutbox1718400000000,
            InitProcessedMessages1718500000000,
          ],
          migrationsRun: true,
          synchronize: false,
        }),
      ],
      providers: [TransactionContext],
      exports: [TransactionContext, TypeOrmModule],
    };
  }
}
