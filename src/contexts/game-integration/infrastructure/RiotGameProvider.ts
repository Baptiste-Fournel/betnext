import { GameProvider } from '../application/ports/GameProvider';
import { MatchOutcomeSide, MatchReport } from '../domain/MatchReport';
import { RiotClient } from './riot/RiotClient';

/** Convention LoL Riot (Match-V5) : teamId 100 = côté HOME, 200 = côté AWAY. */
const RIOT_TEAM_TO_SIDE: Record<number, MatchOutcomeSide> = { 100: 'HOME', 200: 'AWAY' };

/**
 * ANTI-CORRUPTION LAYER : traduit le payload Riot (infra) → `MatchReport` INTERNE. Convention POC :
 * teamId 100 = HOME, 200 = AWAY ; match fini sans équipe gagnante = DRAW ; non disponible = PENDING.
 * Le domaine/applicatif ne voit JAMAIS la shape Riot — uniquement le `MatchReport` produit ici.
 */
export class RiotGameProvider implements GameProvider {
  constructor(private readonly client: RiotClient) {}

  async fetchMatchReport(matchId: string): Promise<MatchReport> {
    const payload = await this.client.getMatch(matchId);
    if (!payload.finished) {
      return { matchId, status: 'PENDING', winner: null };
    }
    const winningTeam = payload.teams.find((t) => t.win);
    if (!winningTeam) {
      return { matchId, status: 'FINISHED', winner: 'DRAW' };
    }
    // Mapping DÉFENSIF : un teamId hors convention (API qui évolue, payload corrompu, champ absent →
    // 0) lève au lieu de retomber silencieusement sur AWAY. Mieux vaut un échec BRUYANT qu'un
    // règlement du MAUVAIS résultat (sécurité argent, défi 3). L'erreur remonte au sync (non réglé).
    const winner = RIOT_TEAM_TO_SIDE[winningTeam.teamId];
    if (!winner) {
      throw new Error(`teamId Riot inattendu (${winningTeam.teamId}) — règlement refusé`);
    }
    return { matchId, status: 'FINISHED', winner };
  }
}
