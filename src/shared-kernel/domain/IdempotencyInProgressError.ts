import { DomainError } from './DomainError';

export class IdempotencyInProgressError extends DomainError {
  constructor(message = 'A request with this Idempotency-Key is already in progress') {
    super(message, 425);
    this.name = 'IdempotencyInProgressError';
  }
}
