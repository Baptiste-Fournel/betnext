import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { CatalogMarket, MarketCatalog } from './ports/MarketCatalog';

export interface CreateMarketInput {
  name: string;
  game: string;
  outcomeLabels: string[];
}

/**
 * Création d'un marché GÉNÉRIQUE (N issues — pas figé à 3). Écriture NORMALE : validation simple
 * (événement nommé, jeu, ≥ 2 issues non vides) ; PAS la rigueur money-safety (aucun argent ici).
 */
export class CreateMarket {
  constructor(private readonly catalog: MarketCatalog) {}

  async execute(input: CreateMarketInput): Promise<CatalogMarket> {
    const name = input.name.trim();
    const game = input.game.trim();
    const outcomeLabels = input.outcomeLabels
      .map((label) => label.trim())
      .filter((label) => label !== '');
    if (!name) {
      throw new DomainError("Le nom de l'événement est requis");
    }
    if (!game) {
      throw new DomainError('Le jeu est requis');
    }
    if (outcomeLabels.length < 2) {
      throw new DomainError('Un marché doit avoir au moins 2 issues');
    }
    return this.catalog.createMarket({ name, game, outcomeLabels });
  }
}
