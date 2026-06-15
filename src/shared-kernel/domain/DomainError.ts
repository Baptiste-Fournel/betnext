/**
 * Erreur de domaine : violation d'un invariant métier (≠ bug de programmation).
 * Les adapters entrants la mappent sur un statut explicite (ex. HTTP 422).
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
