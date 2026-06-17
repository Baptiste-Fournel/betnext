import {
  CreatedMarket,
  MarketCreationPort,
  MarketCreationRequest,
} from '../../../shared-kernel/ports/MarketCreationPort';
import { CreateMarket } from '../application/CreateMarket';

export class CatalogMarketCreation implements MarketCreationPort {
  constructor(private readonly useCase: CreateMarket) {}

  async createMarket(request: MarketCreationRequest): Promise<CreatedMarket> {
    const market = await this.useCase.execute({
      name: request.name,
      game: request.game,
      outcomeLabels: request.outcomeLabels,
    });
    return {
      id: market.id,
      name: market.name,
      game: market.game,
      outcomes: market.outcomes.map((o) => ({ id: o.id, label: o.label })),
    };
  }
}
