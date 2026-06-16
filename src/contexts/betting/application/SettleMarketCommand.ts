/** Commande CQRS : régler un marché à sa clôture (résultat connu, ou annulation). */
export class SettleMarketCommand {
  constructor(
    public readonly outcomes: string[],
    public readonly winningOutcomeId: string | null,
    public readonly voided: boolean,
    public readonly strategyKey?: string,
  ) {}
}
