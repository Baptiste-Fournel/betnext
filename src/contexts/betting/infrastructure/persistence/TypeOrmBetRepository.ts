import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { Bet } from '../../domain/Bet';
import { BetStatus } from '../../domain/BetStatus';
import { Odds } from '../../../../shared-kernel/domain/Odds';
import { BetRepository, StoredBetEvent } from '../../application/ports/BetRepository';
import { TransactionContext } from '../../../../persistence/TransactionContext';
import { BetRecord } from './BetRecord';
import { BetEventRecord } from './BetEventRecord';
import { OutboxRecord } from './OutboxRecord';

/**
 * Adapter Postgres. Mapping ORM↔domaine confiné ici (hexagonal). `save` écrit le snapshot,
 * APPEND les événements (journal) ET insère les lignes OUTBOX, dans UNE transaction (ambiante si
 * fournie par la UnitOfWork — BET-5). Donc un rollback n'écrit ni pari, ni event, ni outbox (BET-7).
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
      const payload = JSON.stringify({ ...event });
      await manager.insert(BetEventRecord, {
        betId: bet.id,
        type: event.type,
        version: 1,
        payload,
        occurredAt: event.occurredAt,
      });
      // Transactional Outbox : même transaction que le pari/journal (ADR-008).
      await manager.insert(OutboxRecord, { id: randomUUID(), type: event.type, payload });
    }
  }

  async findById(id: string): Promise<Bet | null> {
    const row = await this.manager().getRepository(BetRecord).findOne({ where: { id } });
    if (!row) return null;
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

  async findPendingByOutcomes(outcomeIds: string[]): Promise<Bet[]> {
    if (outcomeIds.length === 0) {
      return [];
    }
    const rows = await this.manager()
      .getRepository(BetRecord)
      .find({ where: { status: BetStatus.Pending, outcomeId: In(outcomeIds) } });
    return rows.map((row) =>
      Bet.restore({
        id: row.id,
        userId: row.userId,
        outcomeId: row.outcomeId,
        stake: Number(row.stake),
        lockedOdds: Odds.of(Number(row.lockedOdds)),
        potentialGain: Number(row.potentialGain),
        status: row.status as BetStatus,
        createdAt: row.createdAt,
      }),
    );
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

  private manager(): EntityManager {
    return this.context.getManager() ?? this.dataSource.manager;
  }
}
