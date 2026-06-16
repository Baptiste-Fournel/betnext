import { Bet } from '../Bet';
import { MarketResult, SettlementDecision, SettlementStrategy } from './SettlementStrategy';

export const WINNING_OUTCOME_STRATEGY = 'WINNING_OUTCOME';

/**
 * Première VRAIE stratégie concrète (marché à N issues), enregistrée par défaut → la couture
 * polymorphe est réellement exercée. Marché annulé → VOID (remboursement EXACT de la mise) ;
 * pari sur l'issue gagnante → WON, payé à la COTE FIGÉE (`potentialGain` stocké) ; sinon → LOST.
 * Le paiement à cote figée assume le P&L fixed-odds, BORNÉ par le clamp des cotes [1.10, 5.00]
 * (liability max = mise × 5) — modèle interne-cohérent et documenté (ADR-009).
 */
export class WinningOutcomeStrategy implements SettlementStrategy {
  readonly key = WINNING_OUTCOME_STRATEGY;

  decide(bet: Bet, result: MarketResult): SettlementDecision {
    if (result.voided) {
      return { kind: 'VOID', payout: bet.stake };
    }
    if (bet.outcomeId === result.winningOutcomeId) {
      return { kind: 'WON', payout: bet.potentialGain };
    }
    return { kind: 'LOST', payout: 0 };
  }
}
