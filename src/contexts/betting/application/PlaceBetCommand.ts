/** Commande CQRS de pose de pari (DTO immuable, sans dépendance framework — ADR-006). */
export class PlaceBetCommand {
  constructor(
    public readonly userId: string,
    public readonly outcomeId: string,
    public readonly stake: number,
  ) {}
}
