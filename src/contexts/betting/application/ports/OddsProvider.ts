import { Odds } from '../../../../shared-kernel/domain/Odds';

export interface CurrentOdds {
  value: Odds;
  provisional: boolean;
}

export interface OddsProvider {
  currentOdds(outcomeId: string): Promise<CurrentOdds>;
}
