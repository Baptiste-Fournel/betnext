/** Query CQRS : timeline des événements d'un pari (Event Sourcing rendu visible). */
export class GetBetHistoryQuery {
  constructor(public readonly betId: string) {}
}
