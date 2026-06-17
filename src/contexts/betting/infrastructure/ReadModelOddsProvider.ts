import { Odds } from '../../../shared-kernel/domain/Odds';
import { openingOdds, OPENING_ODDS_VALUE } from '../../../shared-kernel/domain/OpeningOdds';
import { CurrentOdds, OddsProvider } from '../application/ports/OddsProvider';
import { OddsReadModel } from '../../../read-model/OddsReadModel';

export const OPENING_ODDS = OPENING_ODDS_VALUE;

export class ReadModelOddsProvider implements OddsProvider {
  constructor(private readonly readModel: OddsReadModel) {}

  async currentOdds(outcomeId: string): Promise<CurrentOdds> {
    const current = await this.readModel.current(outcomeId);
    return current == null
      ? { value: openingOdds(), provisional: true }
      : { value: Odds.of(current), provisional: false };
  }
}
