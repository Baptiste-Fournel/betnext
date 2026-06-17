import { RiotClient, RiotMatchPayload } from './RiotClient';

/**
 * Client Riot STUB (mode SANS clé : démo locale + CI). Déterministe, zéro réseau, zéro clé : renvoie
 * un match FINI où l'équipe 100 (→ HOME via l'ACL) gagne → permet de démontrer le règlement
 * automatique sans appeler Riot. L'app et la CI démarrent et tournent sans `RIOT_API_KEY`.
 */
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
