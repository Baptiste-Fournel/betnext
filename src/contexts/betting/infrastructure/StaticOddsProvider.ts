import { Odds } from '../../../shared-kernel/domain/Odds';
import { OddsProvider } from '../application/ports/OddsProvider';

/** Stub de démarrage : en production, la cote vient du read-model alimenté par Pricing (ADR-002/006). */
export class StaticOddsProvider implements OddsProvider {
  async currentOdds(_outcomeId: string): Promise<Odds> {
    return Odds.of(2);
  }
}
