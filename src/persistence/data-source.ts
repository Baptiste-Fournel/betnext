import 'reflect-metadata';
import { DataSource } from 'typeorm';
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

/** DataSource du CLI TypeORM (migration:run/revert). DATABASE_URL par défaut = POC local. */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgres://betnext:betnext@localhost:5432/betnext',
  entities: [
    BetRecord,
    BetEventRecord,
    OutboxRecord,
    IdempotencyKeyRecord,
    WalletRecord,
    WalletOperationRecord,
    ProcessedMessageRecord,
  ],
  migrations: [
    InitBetting1718200000000,
    InitWallet1718300000000,
    InitOutbox1718400000000,
    InitProcessedMessages1718500000000,
    InitIdempotencyKeys1718600000000,
    InitWalletOperations1718700000000,
    InitBetSettlementGuard1718800000000,
  ],
  synchronize: false,
});

export default AppDataSource;
