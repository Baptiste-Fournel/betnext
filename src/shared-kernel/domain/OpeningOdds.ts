import { Odds } from './Odds';

// Ligne d'ouverture servie tant qu'un marché n'a aucun volume (le modèle pari-mutuel
// ne produit pas de cote à 0 mise). Source UNIQUE partagée par la cote affichée
// (read-model) et la cote figée au pari (betting) : money-safety = afficher == figer.
// En shared-kernel car betting ne peut pas importer le contexte pricing (frontières).
export const OPENING_ODDS_VALUE = 2;

export function openingOdds(): Odds {
  return Odds.of(OPENING_ODDS_VALUE);
}
