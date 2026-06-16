import { Bet } from '../Bet';

export type SettlementKind = 'WON' | 'LOST' | 'VOID' | 'PARTIAL';

/** Résultat d'un marché transmis aux stratégies. `voided` = marché annulé (remboursement). */
export interface MarketResult {
  winningOutcomeId: string | null;
  voided: boolean;
}

/** Décision de règlement pour UN pari : statut + montant à créditer (0 si perdu). */
export interface SettlementDecision {
  kind: SettlementKind;
  payout: number;
}

/**
 * Stratégie de règlement (Strategy — ADR-009 / défi 4). Décide W/L/V (et, à terme, PARTIAL) pour
 * un pari selon le résultat du marché. PURE (domaine) : aucune I/O. Ajouter un TYPE de pari =
 * nouvelle stratégie + 1 enregistrement dans la factory, SANS toucher le règlement existant.
 * PARTIAL est un statut que la couture PEUT produire ; aucune logique de partial-payout n'est
 * implémentée (type de pari non validé — hypothèse signalée).
 */
export interface SettlementStrategy {
  readonly key: string;
  decide(bet: Bet, result: MarketResult): SettlementDecision;
}
