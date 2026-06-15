/** Commande CQRS de pose de pari (DTO immuable). Porte la clé d'idempotence + le hash du corps. */
export class PlaceBetCommand {
  constructor(
    public readonly userId: string,
    public readonly outcomeId: string,
    public readonly stake: number,
    public readonly idempotencyKey: string,
    public readonly requestHash: string,
  ) {}
}
