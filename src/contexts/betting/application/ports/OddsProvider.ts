import { Odds } from '../../../../shared-kernel/domain/Odds';

/** Port de lecture de la cote courante (alimenté par le service Pricing — ADR-002). */
export interface OddsProvider {
  currentOdds(outcomeId: string): Promise<Odds>;
}
