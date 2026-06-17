/** Query CQRS : lire un pari (read-your-writes). `requesterUserId` (du token) → scoping anti-IDOR. */
export class GetBetQuery {
  constructor(
    public readonly betId: string,
    public readonly requesterUserId: string,
  ) {}
}
