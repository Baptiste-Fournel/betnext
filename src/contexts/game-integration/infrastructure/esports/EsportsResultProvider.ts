import { GameProvider } from '../../application/ports/GameProvider';
import { MatchOutcomeSide, MatchReport } from '../../domain/MatchReport';

// Forme BRUTE de la réponse LoL Esports getEventDetails. Confinée à cet adapter (ACL) : rien de
// ce vocabulaire externe ne franchit le port GameProvider.
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

// Adapter de RÉSULTATS (BET-32) : pour un match ingéré, interroge LoL Esports getEventDetails et
// projette le résultat sur notre `MatchReport` (côté gagnant). Convention d'ordre : teams[0]=HOME,
// teams[1]=AWAY — identique à l'ordre de getSchedule consommé à l'ingestion (vérifié), donc le
// côté gagnant s'aligne sur le mapping côté→issue posé sur le lien. Money-safety : tout cas
// ambigu/incomplet → PENDING (jamais de règlement sur des données douteuses).
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
    // Forme imprévue (≠ 2 équipes) : on ne devine pas, on ne règle pas.
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
      // Deux « gagnants » : résultat incohérent → on refuse de régler.
      throw new Error('Résultat LoL Esports incohérent (deux gagnants) — règlement refusé');
    }
    const winner: MatchOutcomeSide = winners[0] === 0 ? 'HOME' : 'AWAY';
    return { matchId, status: 'FINISHED', winner };
  }
}
