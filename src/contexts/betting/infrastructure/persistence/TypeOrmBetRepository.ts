import { DataSource, EntityManager } from 'typeorm';
import { Bet } from '../../domain/Bet';
import { BetStatus } from '../../domain/BetStatus';
import { Odds } from '../../../../shared-kernel/domain/Odds';
import { BetRepository, StoredBetEvent } from '../../application/ports/BetRepository';
import { TransactionContext } from '../../../../persistence/TransactionContext';
import { BetRecord } from './BetRecord';
import { BetEventRecord } from './BetEventRecord';

/**
 * Adapter Postgres (TypeORM). Tout le mapping ORM↔domaine est confiné ici (hexagonal).
 * `save` écrit le snapshot + APPEND les événements ; si une transaction ambiante existe
 * (TransactionContext, ouverte par la UnitOfWork — couture BET-5) il la REJOINT, sinon il ouvre
 * la sienne. `pullEvents()` est appelé DANS la transaction → extraction et écriture atomiques.
 */
export class TypeOrmBetRepository implements BetRepository {
  constructor(
    private readonly dataSource: DataSource,
    private readonly context: TransactionContext,
  ) {}

  async save(bet: Bet): Promise<void> {
    const ambient = this.context.getManager();
    if (ambient) {
      await this.persist(ambient, bet);
    } else {
      await this.dataSource.transaction((manager) => this.persist(manager, bet));
    }
  }

  private async persist(manager: EntityManager, bet: Bet): Promise<void> {
    const snapshot: BetRecord = {
      id: bet.id,
      userId: bet.userId,
      outcomeId: bet.outcomeId,
      stake: bet.stake,
      lockedOdds: bet.lockedOdds.value,
      potentialGain: bet.potentialGain,
      status: bet.status,
      createdAt: bet.createdAt,
    };
    const events = bet.pullEvents();
    await manager.save(BetRecord, snapshot);
    for (const event of events) {
      await manager.insert(BetEventRecord, {
        betId: bet.id,
        type: event.type,
        version: 1,
        payload: JSON.stringify({ ...event }),
        occurredAt: event.occurredAt,
      });
    }
  }

  async findById(id: string): Promise<Bet | null> {
    const row = await this.manager().getRepository(BetRecord).findOne({ where: { id } });
    if (!row) return null;
    // Snapshot autoritatif : cote ET gain lus tels quels, jamais recalculés.
    return Bet.restore({
      id: row.id,
      userId: row.userId,
      outcomeId: row.outcomeId,
      stake: Number(row.stake),
      lockedOdds: Odds.of(Number(row.lockedOdds)),
      potentialGain: Number(row.potentialGain),
      status: row.status as BetStatus,
      createdAt: row.createdAt,
    });
  }

  async history(betId: string): Promise<StoredBetEvent[]> {
    const rows = await this.manager()
      .getRepository(BetEventRecord)
      .find({ where: { betId }, order: { seq: 'ASC' } });
    return rows.map((r) => ({
      seq: Number(r.seq),
      betId: r.betId,
      type: r.type,
      version: r.version,
      payload: JSON.parse(r.payload) as unknown,
      occurredAt: r.occurredAt,
    }));
  }

  /** EntityManager de la transaction ambiante si présente, sinon le manager par défaut. */
  private manager(): EntityManager {
    return this.context.getManager() ?? this.dataSource.manager;
  }
}
