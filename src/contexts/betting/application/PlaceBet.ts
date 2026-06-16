import { Bet } from '../domain/Bet';
import { BetRepository } from './ports/BetRepository';
import { OddsProvider } from './ports/OddsProvider';
import { IdGenerator } from './ports/IdGenerator';
import { UnitOfWork } from './ports/UnitOfWork';
import { WalletDebitPort } from '../../../shared-kernel/ports/WalletDebitPort';
import { StakeGuardPort } from '../../../shared-kernel/ports/StakeGuardPort';

export interface PlaceBetInput {
  userId: string;
  outcomeId: string;
  stake: number;
}

export interface PlaceBetOutput {
  betId: string;
  lockedOdds: number;
  potentialGain: number;
  /** true si la cote figée vient du défaut d'ouverture (read-model froid) — cohérence éventuelle visible. */
  pricingProvisional?: boolean;
}

/** Garde de mise par défaut : no-op (chemins/tests sans Responsible Gaming). En prod : injecté. */
const NO_STAKE_GUARD: StakeGuardPort = { reserve: async (): Promise<void> => undefined };

/**
 * Use case applicatif (dépend uniquement de ports). Dans UNE SEULE transaction (ADR-003 / BET-5) :
 * (1) RÉSERVE la mise auprès de Responsible Gaming (plafond quotidien — BET-13), (2) DÉBITE le
 * wallet via son port partagé, (3) INSÈRE le pari + ses événements → tout-ou-rien (un refus de
 * plafond ou un solde insuffisant roule TOUT en arrière). La cote vient du read-model (BET-10) et
 * est FIGÉE à la pose. L'idempotence HTTP (anti double-débit au retry) est portée par BET-18.
 * Le garde de mise est optionnel (défaut no-op) ; en prod, le StakeGuardPort de Compliance est
 * injecté et sa réservation est ATOMIQUE avec la pose (verrou → anti-course sur le plafond).
 */
export class PlaceBet {
  constructor(
    private readonly bets: BetRepository,
    private readonly odds: OddsProvider,
    private readonly wallet: WalletDebitPort,
    private readonly ids: IdGenerator,
    private readonly uow: UnitOfWork,
    private readonly stakeGuard: StakeGuardPort = NO_STAKE_GUARD,
  ) {}

  async execute(input: PlaceBetInput): Promise<PlaceBetOutput> {
    const current = await this.odds.currentOdds(input.outcomeId);
    const betId = this.ids.next();
    const bet = Bet.place({
      id: betId,
      userId: input.userId,
      outcomeId: input.outcomeId,
      stake: input.stake,
      currentOdds: current.value,
    });

    await this.uow.withTransaction(async () => {
      await this.stakeGuard.reserve(input.userId, input.stake, new Date());
      await this.wallet.debit(input.userId, input.stake, betId);
      await this.bets.save(bet);
    });

    return {
      betId,
      lockedOdds: bet.lockedOdds.value,
      potentialGain: bet.potentialGain,
      pricingProvisional: current.provisional,
    };
  }
}
