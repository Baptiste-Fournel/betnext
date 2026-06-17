import { MatchOutcomeSide } from '../domain/MatchReport';

export interface FeaturedFixtureOutcome {
  id: string;
  label: string;
  side: MatchOutcomeSide;
}

export interface FeaturedFixture {
  matchId: string;
  region: string;
  market: {
    id: string;
    name: string;
    game: string;
    outcomes: FeaturedFixtureOutcome[];
  };
}

// Source de vérité unique des matchs Riot mis en avant pour la démo.
// Consommée à la fois par le seed BDD (scripts/seed.cjs insère les marchés) et par le
// bootstrap du module game-integration (enregistre le lien match↔marché en mémoire).
// matchId : parties LoL réelles DÉJÀ TERMINÉES → règlement en direct avec RIOT_API_KEY.
// Routing Match-V5 sur europe (cf. HttpRiotClient) ; la région reste une métadonnée.
// HOME = teamId 100, AWAY = teamId 200 (cf. RiotGameProvider). Pas d'issue DRAW en LoL.
export const FEATURED_FIXTURES: readonly FeaturedFixture[] = [
  {
    matchId: 'EUW1_7437325115',
    region: 'EUW',
    market: {
      id: 'mkt-featured-euw1-7437325115',
      name: 'Riot Featured — Blue side vs Red side (EUW1_7437325115)',
      game: 'LoL',
      outcomes: [
        { id: 'mkt-featured-euw1-7437325115-1', label: 'Victoire Blue side', side: 'HOME' },
        { id: 'mkt-featured-euw1-7437325115-2', label: 'Victoire Red side', side: 'AWAY' },
      ],
    },
  },
];
