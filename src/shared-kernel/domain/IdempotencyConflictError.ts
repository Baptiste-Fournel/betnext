import { DomainError } from './DomainError';

export class IdempotencyConflictError extends DomainError {
  constructor(message = 'Idempotency-Key already used with a different request') {
    super(message, 409);
    this.name = 'IdempotencyConflictError';
  }
}
