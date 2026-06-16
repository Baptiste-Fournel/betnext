import { DomainError } from './DomainError';

/** Une requête avec cette Idempotency-Key est déjà en cours (tentative concurrente non finie) → 425. */
export class IdempotencyInProgressError extends DomainError {
  constructor(message = 'A request with this Idempotency-Key is already in progress') {
    super(message, 425);
    this.name = 'IdempotencyInProgressError';
  }
}
