import { DataSource, EntityManager } from 'typeorm';
import { TransactionContext } from '../../../persistence/TransactionContext';
import { ComplianceStore, DailyReservation } from '../application/ports/ComplianceStore';

/**
 * Adapter Postgres du contexte Responsible Gaming. `loadForReserve` garantit la ligne du jour puis
 * la VERROUILLE (`SELECT ... FOR UPDATE`) → deux paris concurrents du même joueur/jour se sérialisent
 * (anti-course). DOIT tourner dans la transaction ambiante (la réservation est atomique avec la pose).
 */
export class TypeOrmComplianceStore implements ComplianceStore {
  constructor(
    private readonly dataSource: DataSource,
    private readonly context: TransactionContext,
  ) {}

  async loadForReserve(userId: string, day: string): Promise<DailyReservation> {
    const manager = this.requireManager();
    await manager.query(
      'INSERT INTO rg_daily_stakes ("userId", "day", "staked") VALUES ($1, $2, 0) ON CONFLICT ("userId", "day") DO NOTHING',
      [userId, day],
    );
    const rows = await manager.query(
      'SELECT "staked" FROM rg_daily_stakes WHERE "userId" = $1 AND "day" = $2 FOR UPDATE',
      [userId, day],
    );
    const caps = await manager.query('SELECT "dailyCap" FROM rg_caps WHERE "userId" = $1', [
      userId,
    ]);
    return {
      dayTotalStaked: Number(rows[0].staked),
      dailyCap: caps.length > 0 ? Number(caps[0].dailyCap) : null,
    };
  }

  async addStake(userId: string, day: string, stake: number): Promise<void> {
    await this.requireManager().query(
      'UPDATE rg_daily_stakes SET "staked" = "staked" + $3 WHERE "userId" = $1 AND "day" = $2',
      [userId, day, stake],
    );
  }

  async setDailyCap(userId: string, cap: number): Promise<void> {
    await this.manager().query(
      'INSERT INTO rg_caps ("userId", "dailyCap") VALUES ($1, $2) ON CONFLICT ("userId") DO UPDATE SET "dailyCap" = $2',
      [userId, cap],
    );
  }

  async currentCap(userId: string): Promise<number | null> {
    const rows = await this.manager().query('SELECT "dailyCap" FROM rg_caps WHERE "userId" = $1', [
      userId,
    ]);
    return rows.length > 0 ? Number(rows[0].dailyCap) : null;
  }

  private requireManager(): EntityManager {
    const manager = this.context.getManager();
    if (!manager) {
      throw new Error('compliance.reserve doit être appelé dans une transaction (UnitOfWork)');
    }
    return manager;
  }

  private manager(): EntityManager {
    return this.context.getManager() ?? this.dataSource.manager;
  }
}
