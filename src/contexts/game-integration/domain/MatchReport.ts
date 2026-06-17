/** Côté vainqueur, modèle INTERNE (neutre, sans aucune notion Riot). */
export type MatchOutcomeSide = 'HOME' | 'AWAY' | 'DRAW';

/**
 * Résultat d'un match, modèle INTERNE produit par l'ACL. Le domaine/applicatif ne voit QUE ça —
 * jamais les shapes Riot (confinées à l'infrastructure). `PENDING` = pas encore joué/disponible.
 */
export interface MatchReport {
  matchId: string;
  status: 'PENDING' | 'FINISHED';
  winner: MatchOutcomeSide | null;
}
