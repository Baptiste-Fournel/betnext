/** Query CQRS : lire un pari (données joueur) — read-your-writes depuis le store autoritatif. */
export class GetBetQuery {
  constructor(public readonly betId: string) {}
}
