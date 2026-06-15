import { Bet } from '../domain/Bet';
import { BetRepository } from './ports/BetRepository';
import { OddsProvider } from './ports/OddsProvider';
import { IdGenerator } from './ports/IdGenerator';
import { UnitOfWork } from './ports/UnitOfWork';
import { WalletDebitPort } from '../../../shared-kernel/ports/WalletDebitPort';

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
 * Use case applicatif (dépend uniquement de ports). ADR-003 / BET-5 : le débit wallet, l'INSERT
 * du pari et l'append des événements s'exécutent dans UNE SEULE transaction via `UnitOfWork` →
 * tout-ou-rien (jamais de débit sans pari, jamais de pari sans débit, aucun event orphelin).
 * Le wallet est débité via son PORT partagé (jamais d'accès direct à ses tables — frontière de
 * contexte respectée même en monolithe).
 *
 * Idempotence : le débit n'est PAS idempotent à ce stade. BET-8 propagera une clé fournie par le
 * CLIENT (header Idempotency-Key) jusqu'au port ; le `betId` (regénéré à chaque appel) ne peut PAS
 * dédoublonner un retry. D'ici là, une fenêtre de double-débit subsiste au retry HTTP.
 */
export class PlaceBet {
  constructor(
    private readonly bets: BetRepository,
    private readonly odds: OddsProvider,
    private readonly wallet: WalletDebitPort,
    private readonly ids: IdGenerator,
    private readonly uow: UnitOfWork,
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

    await this.uow.withTransaction(async () => {
      await this.wallet.debit(input.userId, input.stake, betId);
      await this.bets.save(bet);
    });

    return { betId, lockedOdds: bet.lockedOdds.value, potentialGain: bet.potentialGain };
  }
}
