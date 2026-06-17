export class PlaceBetCommand {
  constructor(
    public readonly userId: string,
    public readonly outcomeId: string,
    public readonly stake: number,
    public readonly idempotencyKey: string,
    public readonly requestHash: string,
  ) {}
}
