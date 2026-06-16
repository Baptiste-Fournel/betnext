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

/** Données d'un nouveau marché (le gestionnaire fournit l'événement + N libellés d'issues). */
export interface NewMarket {
  name: string;
  game: string;
  outcomeLabels: string[];
}

/** Port du catalogue : lecture + création (modèle GÉNÉRIQUE N-issues, ADR-009). */
export interface MarketCatalog {
  listOpenMarkets(): Promise<CatalogMarket[]>;
  createMarket(market: NewMarket): Promise<CatalogMarket>;
}
