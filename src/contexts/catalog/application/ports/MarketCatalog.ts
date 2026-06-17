export const MARKET_CATALOG = Symbol('MarketCatalog');

export interface CatalogOutcome {
  id: string;
  label: string;
}
export interface CatalogMarket {
  id: string;
  name: string;
  game: string;
  outcomes: CatalogOutcome[];
}

export interface NewMarket {
  name: string;
  game: string;
  outcomeLabels: string[];
}

export interface MarketCatalog {
  listOpenMarkets(): Promise<CatalogMarket[]>;
  createMarket(market: NewMarket): Promise<CatalogMarket>;
}
