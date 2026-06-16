/**
 * Erreur de domaine : violation d'un invariant métier (≠ bug de programmation). Porte un indice
 * `status` HTTP optionnel → les adapters entrants mappent SANS connaître chaque type d'erreur
 * (open/closed). Défaut côté filtre si absent : 422.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
