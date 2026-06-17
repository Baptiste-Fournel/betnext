import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { MatchOutcomeSide } from '../domain/MatchReport';
import { MatchLink, MatchLinkStore } from './ports/MatchLinkStore';

export interface RegisterMatchLinkInput {
  matchId: string;
  outcomes: string[];
  mapping: Partial<Record<MatchOutcomeSide, string>>;
}

const SIDES: readonly MatchOutcomeSide[] = ['HOME', 'AWAY', 'DRAW'];

/**
 * Lie un match (externe) à un marché interne : ses issues + le mapping côté-vainqueur → issue. Valide
 * que le mapping ne référence que des issues du marché. Écriture NORMALE (pas d'argent).
 */
export class RegisterMatchLink {
  constructor(private readonly links: MatchLinkStore) {}

  async execute(input: RegisterMatchLinkInput): Promise<MatchLink> {
    const matchId = input.matchId?.trim();
    if (!matchId) {
      throw new DomainError('matchId requis');
    }
    const outcomes = (input.outcomes ?? []).map((o) => o.trim()).filter((o) => o !== '');
    if (outcomes.length < 2) {
      throw new DomainError('au moins 2 issues requises');
    }
    const entries = Object.entries(input.mapping ?? {}) as Array<[MatchOutcomeSide, string]>;
    if (entries.length === 0) {
      throw new DomainError('mapping côté→issue requis');
    }
    for (const [side, outcomeId] of entries) {
      if (!SIDES.includes(side)) {
        throw new DomainError(`côté invalide : ${side}`);
      }
      if (!outcomes.includes(outcomeId)) {
        throw new DomainError(`l'issue « ${outcomeId} » (${side}) n'appartient pas au marché`);
      }
    }
    const link: MatchLink = { matchId, outcomes, mapping: input.mapping };
    await this.links.save(link);
    return link;
  }
}
