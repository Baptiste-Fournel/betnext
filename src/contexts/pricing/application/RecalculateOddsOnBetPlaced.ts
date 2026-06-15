import { OddsCalculator } from '../domain/OddsCalculator';
import { OddsPublisher, OddsUpdate } from './ports/OddsPublisher';
import { PricingStore } from './ports/PricingStore';

/** Contrat d'event consommé (sous-ensemble du payload BetPlaced + id de message) — aucun import de Betting. */
export interface BetPlacedMessage {
  messageId: string;
  outcomeId: string;
  stake: number;
}

/**
 * Réaction ASYNCHRONE de Pricing à BetPlaced, HORS du chemin d'écriture du pari. L'état (totaux
 * par issue) vit dans un PricingStore (port) → l'adapter Redis le partage entre répliques (scale-out
 * correct) et le rend durable. Le consommateur est IDEMPOTENT (markProcessed) : une re-livraison
 * at-least-once n'incrémente pas deux fois. Couplage à Betting uniquement par le CONTRAT d'event.
 * NB (POC) : un seul marché (totaux globaux par issue) ; le groupement multi-événements (eventId
 * porté par l'event, clé Redis par marché) est une évolution à valider, hors périmètre de cette preuve.
 */
export class RecalculateOddsOnBetPlaced {
  constructor(
    private readonly store: PricingStore,
    private readonly calculator: OddsCalculator,
    private readonly publisher: OddsPublisher,
  ) {}

  async handle(message: BetPlacedMessage): Promise<OddsUpdate[] | null> {
    const fresh = await this.store.markProcessed(message.messageId);
    if (!fresh) {
      return null; // re-livraison (at-least-once) → no-op, jamais de double comptage
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
