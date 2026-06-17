import { RiotClient, RiotMatchPayload } from './RiotClient';

interface RawRiotMatchV5 {
  metadata?: { matchId?: string };
  info?: { teams?: Array<{ teamId?: number; win?: boolean }> };
}

export class HttpRiotClient implements RiotClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://europe.api.riotgames.com',
  ) {}

  async getMatch(matchId: string): Promise<RiotMatchPayload> {
    const res = await fetch(`${this.baseUrl}/lol/match/v5/matches/${encodeURIComponent(matchId)}`, {
      headers: { 'X-Riot-Token': this.apiKey },
    });
    if (res.status === 404) {
      return { matchId, finished: false, teams: [] };
    }
    if (!res.ok) {
      throw new Error(`Appel Riot en échec (HTTP ${res.status})`);
    }
    const raw = (await res.json()) as RawRiotMatchV5;
    const teams = (raw.info?.teams ?? []).map((t) => ({
      teamId: t.teamId ?? 0,
      win: t.win === true,
    }));
    return { matchId: raw.metadata?.matchId ?? matchId, finished: true, teams };
  }
}
