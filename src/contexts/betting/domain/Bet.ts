import { BetStatus } from './BetStatus';
import { Odds } from '../../../shared-kernel/domain/Odds';
import { DomainEvent } from '../../../shared-kernel/domain/DomainEvent';
import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { BetPlaced, BetWon, BetLost, BetVoided } from './events';

export interface PlaceBetProps {
  id: string;
  userId: string;
  outcomeId: string;
  stake: number;
  currentOdds: Odds;
}

/** Snapshot autoritatif persisté (ADR-005) : cote ET gain figés sont stockés, pas reconstruits. */
export interface BetSnapshot {
  id: string;
  userId: string;
  outcomeId: string;
  stake: number;
  lockedOdds: Odds;
  potentialGain: number;
  status: BetStatus;
  createdAt: Date;
}

export class Bet {
  private _events: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly outcomeId: string,
    readonly stake: number,
    readonly lockedOdds: Odds,
    /** Gain potentiel FIGÉ à la pose et STOCKÉ — jamais recalculé à la lecture (ADR-005). */
    readonly potentialGain: number,
    private _status: BetStatus,
    readonly createdAt: Date,
  ) {}

  static place(props: PlaceBetProps): Bet {
    if (!(props.stake > 0)) {
      throw new DomainError('Stake must be strictly positive');
    }
    const potentialGain = Math.round(props.stake * props.currentOdds.value * 100) / 100;
    const bet = new Bet(
      props.id,
      props.userId,
      props.outcomeId,
      props.stake,
      props.currentOdds,
      potentialGain,
      BetStatus.Pending,
      new Date(),
    );
    bet.record(new BetPlaced(bet.id, bet.userId, bet.outcomeId, bet.stake, bet.lockedOdds.value));
    return bet;
  }

  /** Réhydrate depuis le snapshot — SANS émettre d'événement ni recalculer cote/gain. */
  static restore(snapshot: BetSnapshot): Bet {
    return new Bet(
      snapshot.id,
      snapshot.userId,
      snapshot.outcomeId,
      snapshot.stake,
      snapshot.lockedOdds,
      snapshot.potentialGain,
      snapshot.status,
      snapshot.createdAt,
    );
  }

  get status(): BetStatus {
    return this._status;
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

  pullEvents(): DomainEvent[] {
    const pending = this._events;
    this._events = [];
    return pending;
  }

  private ensurePending(): void {
    if (this._status !== BetStatus.Pending) {
      throw new DomainError(`Illegal transition from ${this._status}`);
    }
  }

  private record(event: DomainEvent): void {
    this._events.push(event);
  }
}
