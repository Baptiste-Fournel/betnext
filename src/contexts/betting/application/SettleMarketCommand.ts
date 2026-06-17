export class SettleMarketCommand {
  constructor(
    public readonly outcomes: string[],
    public readonly winningOutcomeId: string | null,
    public readonly voided: boolean,
    public readonly strategyKey?: string,
  ) {}
}
