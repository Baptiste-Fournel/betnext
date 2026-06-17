export const MARKET_CREATION_PORT = Symbol('MarketCreationPort');

export interface MarketCreationRequest {
  name: string;
  game: string;
  outcomeLabels: string[];
}

export interface CreatedMarketOutcome {
  id: string;
  label: string;
}

export interface CreatedMarket {
  id: string;
  name: string;
  game: string;
  outcomes: CreatedMarketOutcome[];
}

export interface MarketCreationPort {
  createMarket(request: MarketCreationRequest): Promise<CreatedMarket>;
}
