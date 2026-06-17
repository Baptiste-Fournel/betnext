import { GameProvider } from '../../application/ports/GameProvider';
import { MatchOutcomeSide, MatchReport } from '../../domain/MatchReport';

interface RawEventDetails {
  data?: { event?: { match?: RawMatch } };
}
interface RawMatch {
  strategy?: { count?: number };
  teams?: Array<{ result?: { gameWins?: number } }>;
}

export interface EsportsResultOptions {
  hl?: string;
}

export class EsportsResultProvider implements GameProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly options: EsportsResultOptions = {},
  ) {}

  async fetchMatchReport(matchId: string): Promise<MatchReport> {
    const hl = this.options.hl ?? 'en-US';
    const res = await fetch(
      `${this.baseUrl}/persisted/gw/getEventDetails?hl=${encodeURIComponent(hl)}&id=${encodeURIComponent(matchId)}`,
      { headers: { 'x-api-key': this.apiKey } },
    );
    if (res.status === 404) {
      return { matchId, status: 'PENDING', winner: null };
    }
    if (!res.ok) {
      throw new Error(`Appel LoL Esports (résultats) en échec (HTTP ${res.status})`);
    }
    const raw = (await res.json()) as RawEventDetails;
    const match = raw.data?.event?.match;
    const teams = match?.teams ?? [];
    if (teams.length !== 2) {
      return { matchId, status: 'PENDING', winner: null };
    }
    const count = match?.strategy?.count ?? 1;
    const required = Math.floor(count / 2) + 1;
    const wins = teams.map((t) => t.result?.gameWins ?? 0);
    const winners = [0, 1].filter((i) => wins[i] >= required);
    if (winners.length === 0) {
      return { matchId, status: 'PENDING', winner: null };
    }
    if (winners.length > 1) {
      throw new Error('Résultat LoL Esports incohérent (deux gagnants) — règlement refusé');
    }
    const winner: MatchOutcomeSide = winners[0] === 0 ? 'HOME' : 'AWAY';
    return { matchId, status: 'FINISHED', winner };
  }
}
