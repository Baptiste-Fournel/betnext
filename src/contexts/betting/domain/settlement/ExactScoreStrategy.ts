import { DomainError } from '../../../../shared-kernel/domain/DomainError';
import { Bet } from '../Bet';
import { MarketResult, SettlementDecision, SettlementStrategy } from './SettlementStrategy';

export const EXACT_SCORE_STRATEGY = 'EXACT_SCORE';

// Type de pari « score exact » (BET-25) — exemple minimal de la couture SettlementStrategy.
// Démontre l'Open/Closed : ce type s'AJOUTE (nouveau fichier + 1 enregistrement dans le module DI),
// SANS toucher WinningOutcomeStrategy, SettlementStrategyFactory ni SettleMarket (le moteur).
// Le marché « score exact » porte N issues de score (ex. 2-0 / 2-1 / 1-2 / 0-2) : le joueur parie
// une grille PRÉCISE. Règlement : seule la grille exacte gagne, tout le reste perd ; une annulation
// rembourse la mise. Distinction money-safe vs 1N2 : un règlement « score exact » NON annulé SANS
// score concret est une erreur de donnée → on lève (le pari reste `failed`/PENDING, jamais perdu à
// tort), là où un 1N2 à `winningOutcomeId=null` marquerait tout le monde LOST.
export class ExactScoreStrategy implements SettlementStrategy {
  readonly key = EXACT_SCORE_STRATEGY;

  decide(bet: Bet, result: MarketResult): SettlementDecision {
    if (result.voided) {
      return { kind: 'VOID', payout: bet.stake };
    }
    if (result.winningOutcomeId === null) {
      throw new DomainError('Score exact : règlement impossible sans grille de score gagnante');
    }
    if (bet.outcomeId === result.winningOutcomeId) {
      return { kind: 'WON', payout: bet.potentialGain };
    }
    return { kind: 'LOST', payout: 0 };
  }
}
