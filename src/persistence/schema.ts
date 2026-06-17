import { BetRecord } from '../contexts/betting/infrastructure/persistence/BetRecord';
import { BetEventRecord } from '../contexts/betting/infrastructure/persistence/BetEventRecord';
import { OutboxRecord } from '../contexts/betting/infrastructure/persistence/OutboxRecord';
import { IdempotencyKeyRecord } from '../contexts/betting/infrastructure/persistence/IdempotencyKeyRecord';
import { WalletRecord } from '../contexts/wallet/infrastructure/persistence/WalletRecord';
import { WalletOperationRecord } from '../contexts/wallet/infrastructure/persistence/WalletOperationRecord';
import { MarketRecord } from '../contexts/catalog/infrastructure/persistence/MarketRecord';
import { UserRecord } from '../contexts/identity/infrastructure/persistence/UserRecord';
import { ProcessedMessageRecord } from '../messaging/ProcessedMessageRecord';
import { InitBetting1718200000000 } from '../contexts/betting/infrastructure/persistence/migrations/1718200000000-InitBetting';
import { InitWallet1718300000000 } from '../contexts/wallet/infrastructure/persistence/migrations/1718300000000-InitWallet';
import { InitOutbox1718400000000 } from '../contexts/betting/infrastructure/persistence/migrations/1718400000000-InitOutbox';
import { InitProcessedMessages1718500000000 } from '../messaging/migrations/1718500000000-InitProcessedMessages';
import { InitIdempotencyKeys1718600000000 } from '../contexts/betting/infrastructure/persistence/migrations/1718600000000-InitIdempotencyKeys';
import { InitWalletOperations1718700000000 } from '../contexts/wallet/infrastructure/persistence/migrations/1718700000000-InitWalletOperations';
import { InitBetSettlementGuard1718800000000 } from '../contexts/betting/infrastructure/persistence/migrations/1718800000000-InitBetSettlementGuard';
import { InitCompliance1718900000000 } from '../contexts/compliance/infrastructure/persistence/migrations/1718900000000-InitCompliance';
import { InitCatalog1719000000000 } from '../contexts/catalog/infrastructure/persistence/migrations/1719000000000-InitCatalog';
import { InitIdentity1719100000000 } from '../contexts/identity/infrastructure/persistence/migrations/1719100000000-InitIdentity';

export const ENTITIES = [
  BetRecord,
  BetEventRecord,
  OutboxRecord,
  IdempotencyKeyRecord,
  WalletRecord,
  WalletOperationRecord,
  MarketRecord,
  UserRecord,
  ProcessedMessageRecord,
];

export const MIGRATIONS = [
  InitBetting1718200000000,
  InitWallet1718300000000,
  InitOutbox1718400000000,
  InitProcessedMessages1718500000000,
  InitIdempotencyKeys1718600000000,
  InitWalletOperations1718700000000,
  InitBetSettlementGuard1718800000000,
  InitCompliance1718900000000,
  InitCatalog1719000000000,
  InitIdentity1719100000000,
];
