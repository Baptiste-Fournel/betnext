export class GetBetQuery {
  constructor(
    public readonly betId: string,
    public readonly requesterUserId: string,
  ) {}
}
