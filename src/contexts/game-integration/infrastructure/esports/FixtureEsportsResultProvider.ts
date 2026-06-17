import { GameProvider } from '../../application/ports/GameProvider';
import { MatchOutcomeSide, MatchReport } from '../../domain/MatchReport';

// Résultats déterministes en mode fixtures (tests + démo). Un match « déjà terminé » renvoie son
// gagnant ; les matchs à venir restent PENDING. Permet de PROUVER le règlement auto en soutenance
// (les vrais matchs à venir ne finissent pas pendant la démo). Aligné sur les externalId de
// `FixtureEsportsScheduleProvider`.
const FINISHED_FIXTURES: Readonly<Record<string, MatchOutcomeSide>> = {
  // G2 Esports (HOME) bat Fnatic (AWAY) — match LEC « récemment terminé » de la démo.
  'esports-fixture-lec-g2-fnc': 'HOME',
};

export class FixtureEsportsResultProvider implements GameProvider {
  async fetchMatchReport(matchId: string): Promise<MatchReport> {
    const winner = FINISHED_FIXTURES[matchId];
    if (!winner) {
      return { matchId, status: 'PENDING', winner: null };
    }
    return { matchId, status: 'FINISHED', winner };
  }
}
