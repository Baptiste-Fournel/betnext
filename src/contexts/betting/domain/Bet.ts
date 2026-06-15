import { BetStatus } from './BetStatus';
import { Odds } from '../../../shared-kernel/domain/Odds';
import { DomainEvent } from '../../../shared-kernel/domain/DomainEvent';
import { BetPlaced, BetWon, BetLost, BetVoided } from './events';

export interface PlaceBetProps {
  id: string;
  userId: string;
  outcomeId: string;
  stake: number;
  currentOdds: Odds; // cote de marché au moment de la pose
}

/**
 * Agrégat Bet. Invariant central (défi 1 / ADR-007) : la cote est FIGÉE à la pose
 * (`lockedOdds`) et n'est jamais recalculée — un mouvement de marché ultérieur ne change
 * pas un pari déjà posé. Transitions d'état gardées (ADR-004, anti double-traitement).
 */
export class Bet {
  private _events: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly outcomeId: string,
    readonly stake: number,
    readonly lockedOdds: Odds,
    private _status: BetStatus,
  ) {}

  static place(props: PlaceBetProps): Bet {
    if (!(props.stake > 0)) {
      throw new RangeError('Stake must be strictly positive');
    }
    const bet = new Bet(
      props.id,
      props.userId,
      props.outcomeId,
      props.stake,
      props.currentOdds,
      BetStatus.Pending,
    );
    bet.record(new BetPlaced(bet.id, bet.userId, bet.outcomeId, bet.stake, bet.lockedOdds.value));
    return bet;
  }

  get status(): BetStatus {
    return this._status;
  }

  /** Gain potentiel, calculé sur la cote FIGÉE — indépendant de tout mouvement de marché. */
  get potentialGain(): number {
    return Math.round(this.stake * this.lockedOdds.value * 100) / 100;
  }

  win(): void {
    this.ensurePending();
    this._status = BetStatus.Won;
    this.record(new BetWon(this.id, this.potentialGain));
  }

  lose(): void {
    this.ensurePending();
    this._status = BetStatus.Lost;
    this.record(new BetLost(this.id));
  }

  voidBet(): void {
    this.ensurePending();
    this._status = BetStatus.Void;
    this.record(new BetVoided(this.id, this.stake));
  }

  /** Récupère et vide les événements en attente (à publier via Outbox — ADR-008). */
  pullEvents(): DomainEvent[] {
    const pending = this._events;
    this._events = [];
    return pending;
  }

  private ensurePending(): void {
    if (this._status !== BetStatus.Pending) {
      throw new Error(`Illegal transition from ${this._status}`);
    }
  }

  private record(event: DomainEvent): void {
    this._events.push(event);
  }
}
