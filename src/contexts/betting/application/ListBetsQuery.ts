/** Query CQRS : lister les paris de l'utilisateur authentifié (scoping anti-IDOR — BET-20). */
export class ListBetsQuery {
  constructor(public readonly userId: string) {}
}
