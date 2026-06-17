/** Query CQRS : timeline d'un pari (Event Sourcing visible). `requesterUserId` (du token) → anti-IDOR. */
export class GetBetHistoryQuery {
  constructor(
    public readonly betId: string,
    public readonly requesterUserId: string,
  ) {}
}
