import { RiotClient, RiotMatchPayload } from './RiotClient';

export class StubRiotClient implements RiotClient {
  async getMatch(matchId: string): Promise<RiotMatchPayload> {
    return {
      matchId,
      finished: true,
      teams: [
        { teamId: 100, win: true },
        { teamId: 200, win: false },
      ],
    };
  }
}
