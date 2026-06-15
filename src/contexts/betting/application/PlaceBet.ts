import { Bet } from '../domain/Bet';
import { BetRepository } from './ports/BetRepository';
import { OddsProvider } from './ports/OddsProvider';
import { WalletPort } from './ports/WalletPort';
import { IdGenerator } from './ports/IdGenerator';

export interface PlaceBetInput {
  userId: string;
  outcomeId: string;
  stake: number;
}

export interface PlaceBetOutput {
  betId: string;
  lockedOdds: number;
  potentialGain: number;
}

/**
 * Use case applicatif. Ne dépend QUE de ports (interfaces), jamais d'un adapter concret
 * ni d'un framework (Dependency Inversion / SOLID). Entièrement testable avec des doublures
 * en mémoire (voir le spec).
 *
 * NB ADR-003 : en production, l'adapter exécute `wallet.debit` + `bets.save` dans UNE SEULE
 * transaction Postgres (unité de travail) pour garantir l'atomicité de l'argent. La clé
 * d'idempotence du débit est l'id du pari (une tentative = un débit).
 */
export class PlaceBet {
  constructor(
    private readonly bets: BetRepository,
    private readonly odds: OddsProvider,
    private readonly wallet: WalletPort,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: PlaceBetInput): Promise<PlaceBetOutput> {
    const currentOdds = await this.odds.currentOdds(input.outcomeId);
    const betId = this.ids.next();
    const bet = Bet.place({
      id: betId,
      userId: input.userId,
      outcomeId: input.outcomeId,
      stake: input.stake,
      currentOdds,
    });

    await this.wallet.debit(input.userId, input.stake, betId);
    await this.bets.save(bet);

    return { betId, lockedOdds: bet.lockedOdds.value, potentialGain: bet.potentialGain };
  }
}
