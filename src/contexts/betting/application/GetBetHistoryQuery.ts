export class GetBetHistoryQuery {
  constructor(
    public readonly betId: string,
    public readonly requesterUserId: string,
  ) {}
}
