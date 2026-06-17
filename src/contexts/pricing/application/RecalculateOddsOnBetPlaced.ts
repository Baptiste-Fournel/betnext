import { OddsCalculator } from '../domain/OddsCalculator';
import { OddsPublisher, OddsUpdate } from './ports/OddsPublisher';
import { PricingStore } from './ports/PricingStore';

export interface BetPlacedMessage {
  messageId: string;
  outcomeId: string;
  stake: number;
}

export class RecalculateOddsOnBetPlaced {
  constructor(
    private readonly store: PricingStore,
    private readonly calculator: OddsCalculator,
    private readonly publisher: OddsPublisher,
  ) {}

  async handle(message: BetPlacedMessage): Promise<OddsUpdate[] | null> {
    const fresh = await this.store.markProcessed(message.messageId);
    if (!fresh) {
      return null;
    }
    await this.store.add(message.outcomeId, message.stake);
    const odds = this.calculator.compute(await this.store.totals());
    const updates: OddsUpdate[] = [...odds].map(([outcomeId, value]) => ({
      outcomeId,
      odds: value.value,
    }));
    await this.publisher.publish(updates);
    return updates;
  }
}
