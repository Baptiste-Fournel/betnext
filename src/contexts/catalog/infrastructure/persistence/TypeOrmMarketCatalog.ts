import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
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
    await this.dataSource.getRepository(MarketRecord).insert(created);
    return created;
  }
}
