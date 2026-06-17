import { Odds } from '../../../shared-kernel/domain/Odds';
import { CurrentOdds, OddsProvider } from '../application/ports/OddsProvider';
import { OddsReadModel } from '../../../read-model/OddsReadModel';

export const OPENING_ODDS = 2;

export class ReadModelOddsProvider implements OddsProvider {
  constructor(private readonly readModel: OddsReadModel) {}

  async currentOdds(outcomeId: string): Promise<CurrentOdds> {
    const current = await this.readModel.current(outcomeId);
    return current == null
      ? { value: Odds.of(OPENING_ODDS), provisional: true }
      : { value: Odds.of(current), provisional: false };
  }
}
