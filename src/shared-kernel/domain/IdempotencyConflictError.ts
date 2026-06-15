import { DomainError } from './DomainError';

/** Même Idempotency-Key réutilisée avec un corps différent → conflit (HTTP 409). */
export class IdempotencyConflictError extends DomainError {
  constructor(message = 'Idempotency-Key already used with a different request') {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}
