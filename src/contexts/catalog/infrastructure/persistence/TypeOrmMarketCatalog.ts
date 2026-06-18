import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { CatalogMarket, MarketCatalog, NewMarket } from '../../application/ports/MarketCatalog';
import { MarketRecord } from './MarketRecord';

export class TypeOrmMarketCatalog implements MarketCatalog {
  constructor(private readonly dataSource: DataSource) {}

  async listOpenMarkets(): Promise<CatalogMarket[]> {
    const rows = await this.dataSource.getRepository(MarketRecord).find();
    return rows.map((r) => ({ id: r.id, name: r.name, game: r.game, outcomes: r.outcomes }));
  }

  async createMarket(market: NewMarket): Promise<CatalogMarket> {
    const id = `mkt-${randomUUID().slice(0, 8)}`;
    const outcomes = market.outcomeLabels.map((label, index) => ({
      id: `${id}-${index + 1}`,
      label,
    }));
    const created: CatalogMarket = { id, name: market.name, game: market.game, outcomes };
    await this.dataSource.transaction(async (manager) => {
      await manager.insert(MarketRecord, created);
      await this.appendMarketCreated(manager, created);
    });
    return created;
  }

  private async appendMarketCreated(manager: EntityManager, market: CatalogMarket): Promise<void> {
    const payload = JSON.stringify({
      type: 'MarketCreated',
      marketId: market.id,
      outcomeIds: market.outcomes.map((o) => o.id),
      occurredAt: new Date().toISOString(),
    });
    await manager.query('INSERT INTO outbox (id, type, payload) VALUES ($1, $2, $3)', [
      randomUUID(),
      'MarketCreated',
      payload,
    ]);
  }
}
