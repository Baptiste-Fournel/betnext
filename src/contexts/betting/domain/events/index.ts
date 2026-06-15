import { DomainEvent } from '../../../../shared-kernel/domain/DomainEvent';

export class BetPlaced implements DomainEvent {
  readonly type = 'BetPlaced';
  readonly occurredAt: Date;
  constructor(
    readonly aggregateId: string,
    readonly userId: string,
    readonly outcomeId: string,
    readonly stake: number,
    readonly lockedOdds: number,
    occurredAt: Date = new Date(),
  ) {
    this.occurredAt = occurredAt;
  }
}

export class BetWon implements DomainEvent {
  readonly type = 'BetWon';
  readonly occurredAt = new Date();
  constructor(
    readonly aggregateId: string,
    readonly payout: number,
  ) {}
}

export class BetLost implements DomainEvent {
  readonly type = 'BetLost';
  readonly occurredAt = new Date();
  constructor(readonly aggregateId: string) {}
}

export class BetVoided implements DomainEvent {
  readonly type = 'BetVoided';
  readonly occurredAt = new Date();
  constructor(
    readonly aggregateId: string,
    readonly stake: number,
  ) {}
}
