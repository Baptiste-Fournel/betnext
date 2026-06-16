import { randomUUID } from 'node:crypto';
import { CatalogMarket, MarketCatalog, NewMarket } from '../application/ports/MarketCatalog';

/**
 * Catalogue en mémoire (POC). Seedé d'un marché à 3 issues (exemple) ; le gestionnaire peut en CRÉER
 * d'autres à N issues (modèle générique). La création assigne les identifiants (marché + issues).
 */
export class InMemoryMarketCatalog implements MarketCatalog {
  private readonly markets: CatalogMarket[] = [
    {
      id: 'mkt-lol-finale',
      name: 'BetNext Major — Team A vs Team B',
      game: 'LoL',
      outcomes: [
        { id: 'lol-finale-a', label: 'Victoire Team A' },
        { id: 'lol-finale-b', label: 'Victoire Team B' },
        { id: 'lol-finale-draw', label: 'Match nul' },
      ],
    },
  ];

  async listOpenMarkets(): Promise<CatalogMarket[]> {
    return this.markets;
  }

  async createMarket(market: NewMarket): Promise<CatalogMarket> {
    const id = `mkt-${randomUUID().slice(0, 8)}`;
    const created: CatalogMarket = {
      id,
      name: market.name,
      game: market.game,
      outcomes: market.outcomeLabels.map((label, index) => ({ id: `${id}-${index + 1}`, label })),
    };
    this.markets.push(created);
    return created;
  }
}
