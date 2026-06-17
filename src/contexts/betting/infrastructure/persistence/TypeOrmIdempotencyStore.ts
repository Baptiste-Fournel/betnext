import { DataSource } from 'typeorm';
import { TransactionContext } from '../../../../persistence/TransactionContext';
import {
  ClaimOutcome,
  IdempotencyStore,
  PlaceBetResult,
} from '../../application/ports/IdempotencyStore';

export class TypeOrmIdempotencyStore implements IdempotencyStore {
  constructor(
    private readonly dataSource: DataSource,
    private readonly context: TransactionContext,
  ) {}

  async claim(key: string, requestHash: string): Promise<ClaimOutcome> {
    const inserted = await this.manager().query(
      'INSERT INTO idempotency_keys ("key", "requestHash") VALUES ($1, $2) ON CONFLICT ("key") DO NOTHING RETURNING "key"',
      [key, requestHash],
    );
    if (inserted.length > 0) {
      return { claimed: true };
    }
    const rows = await this.manager().query(
      'SELECT "requestHash", "betId", "lockedOdds", "potentialGain" FROM idempotency_keys WHERE "key" = $1',
      [key],
    );
    const r = rows[0];
    return {
      claimed: false,
      existing: {
        requestHash: r.requestHash,
        betId: r.betId ?? null,
        lockedOdds: r.lockedOdds == null ? null : Number(r.lockedOdds),
        potentialGain: r.potentialGain == null ? null : Number(r.potentialGain),
      },
    };
  }

  async complete(key: string, result: PlaceBetResult): Promise<void> {
    await this.manager().query(
      'UPDATE idempotency_keys SET "betId" = $2, "lockedOdds" = $3, "potentialGain" = $4 WHERE "key" = $1',
      [key, result.betId, result.lockedOdds, result.potentialGain],
    );
  }

  async release(key: string): Promise<void> {
    await this.manager().query('DELETE FROM idempotency_keys WHERE "key" = $1', [key]);
  }

  private manager() {
    return this.context.getManager() ?? this.dataSource.manager;
  }
}
