import { Odds } from '../../../shared-kernel/domain/Odds';
import { CurrentOdds, OddsProvider } from '../application/ports/OddsProvider';
import { OddsReadModel } from '../../../read-model/OddsReadModel';

/** Cote d'OUVERTURE par défaut (POC) tant que le read-model est froid (avant tout OddsUpdated). */
export const OPENING_ODDS = 2;

/**
 * Lit la cote COURANTE depuis le read-model (Redis) — plus jamais la base d'écriture. Cold cache
 * (aucun OddsUpdated encore projeté) → cote d'ouverture documentée, signalée `provisional: true`
 * (la latence de cohérence reste OBSERVABLE jusque sur le chemin de pose). La cote lue est ensuite
 * FIGÉE par PlaceBet : une MAJ ultérieure du read-model ne change pas le pari déjà posé.
 */
export class ReadModelOddsProvider implements OddsProvider {
  constructor(private readonly readModel: OddsReadModel) {}

  async currentOdds(outcomeId: string): Promise<CurrentOdds> {
    const current = await this.readModel.current(outcomeId);
    return current == null
      ? { value: Odds.of(OPENING_ODDS), provisional: true }
      : { value: Odds.of(current), provisional: false };
  }
}
