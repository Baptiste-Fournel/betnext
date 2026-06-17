import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { MarketCreationPort } from '../../../shared-kernel/ports/MarketCreationPort';
import { MatchOutcomeSide } from '../domain/MatchReport';
import { MatchLink, MatchLinkStore } from './ports/MatchLinkStore';

export interface FeaturedOutcomeInput {
  label: string;
  side: MatchOutcomeSide;
}

export interface FeatureRiotMatchInput {
  name: string;
  game: string;
  matchId: string;
  region?: string;
  outcomes: FeaturedOutcomeInput[];
}

export interface FeaturedMatch {
  matchId: string;
  marketId: string;
  region: string | null;
  outcomes: string[];
  mapping: Partial<Record<MatchOutcomeSide, string>>;
}

const SIDES: readonly MatchOutcomeSide[] = ['HOME', 'AWAY', 'DRAW'];

export class FeatureRiotMatch {
  constructor(
    private readonly markets: MarketCreationPort,
    private readonly links: MatchLinkStore,
  ) {}

  async execute(input: FeatureRiotMatchInput): Promise<FeaturedMatch> {
    const matchId = input.matchId?.trim();
    if (!matchId) {
      throw new DomainError('matchId requis');
    }
    const outcomes = input.outcomes ?? [];
    if (outcomes.length < 2) {
      throw new DomainError('au moins 2 issues requises');
    }
    const seenSides = new Set<MatchOutcomeSide>();
    for (const outcome of outcomes) {
      if (!SIDES.includes(outcome.side)) {
        throw new DomainError(`côté invalide : ${String(outcome.side)}`);
      }
      if (seenSides.has(outcome.side)) {
        throw new DomainError(`côté en double : ${outcome.side}`);
      }
      seenSides.add(outcome.side);
      if (!outcome.label?.trim()) {
        throw new DomainError("libellé d'issue requis");
      }
    }

    // Le marché n'est créé qu'une fois le lien garanti formable (matchId + sides valides),
    // pour ne jamais laisser un marché orphelin si le mapping est rejeté.
    const market = await this.markets.createMarket({
      name: input.name,
      game: input.game,
      outcomeLabels: outcomes.map((o) => o.label.trim()),
    });
    // Défensif : l'adapter catalog génère un id d'issue par label, dans l'ordre. Si ce
    // contrat est rompu, on refuse plutôt que de produire un mapping faux (money-safety).
    if (market.outcomes.length !== outcomes.length) {
      throw new DomainError('incohérence entre les issues demandées et le marché créé');
    }

    const mapping: Partial<Record<MatchOutcomeSide, string>> = {};
    market.outcomes.forEach((created, index) => {
      mapping[outcomes[index].side] = created.id;
    });
    const outcomeIds = market.outcomes.map((o) => o.id);
    const region = input.region?.trim() || null;

    const link: MatchLink = {
      matchId,
      outcomes: outcomeIds,
      mapping,
      marketId: market.id,
      ...(region ? { region } : {}),
    };
    await this.links.save(link);

    return { matchId, marketId: market.id, region, outcomes: outcomeIds, mapping };
  }
}
