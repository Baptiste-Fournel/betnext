import { PlaceBet, PlaceBetInput, PlaceBetOutput } from './PlaceBet';
import { UnitOfWork } from './ports/UnitOfWork';
import { IdempotencyStore } from './ports/IdempotencyStore';
import { IdempotencyConflictError } from '../../../shared-kernel/domain/IdempotencyConflictError';
import { IdempotencyInProgressError } from '../../../shared-kernel/domain/IdempotencyInProgressError';

export interface IdempotentPlaceBetInput extends PlaceBetInput {
  idempotencyKey: string;
  requestHash: string;
}

export class IdempotentPlaceBet {
  constructor(
    private readonly placeBet: PlaceBet,
    private readonly store: IdempotencyStore,
    private readonly uow: UnitOfWork,
  ) {}

  execute(input: IdempotentPlaceBetInput): Promise<PlaceBetOutput> {
    return this.uow.withTransaction(async () => {
      const claim = await this.store.claim(input.idempotencyKey, input.requestHash);
      if (!claim.claimed) {
        if (claim.existing.requestHash !== input.requestHash) {
          throw new IdempotencyConflictError();
        }
        if (claim.existing.betId === null) {
          throw new IdempotencyInProgressError();
        }
        return {
          betId: claim.existing.betId,
          lockedOdds: claim.existing.lockedOdds as number,
          potentialGain: claim.existing.potentialGain as number,
        };
      }
      try {
        const result = await this.placeBet.execute({
          userId: input.userId,
          outcomeId: input.outcomeId,
          stake: input.stake,
        });
        await this.store.complete(input.idempotencyKey, result);
        return result;
      } catch (error) {
        await this.store.release(input.idempotencyKey).catch(() => undefined);
        throw error;
      }
    });
  }
}
