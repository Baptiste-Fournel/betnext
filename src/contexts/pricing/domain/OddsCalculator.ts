import { Odds } from '../../../shared-kernel/domain/Odds';

/** Totaux misés par issue (clé = id d'issue). */
export type StakeByOutcome = ReadonlyMap<string, number>;

/**
 * Pricing pari-mutuel : cote(issue) = total misé sur l'événement / total misé sur l'issue,
 * borné dans [Odds.MIN, Odds.MAX] ; une issue sans mise reçoit la cote maximale.
 * Service de domaine PUR (aucun framework, aucune I/O) — trivialement testable (voir le spec).
 * Reproduit la formule du legacy (OddsCalculatorService.php:44) mais générique N-issues.
 */
export class OddsCalculator {
  compute(stakes: StakeByOutcome): Map<string, Odds> {
    const totalEvent = [...stakes.values()].reduce((sum, s) => sum + s, 0);
    const result = new Map<string, Odds>();
    for (const [outcomeId, staked] of stakes) {
      const ratio = staked === 0 ? Infinity : totalEvent / staked;
      result.set(outcomeId, Odds.fromRatio(ratio));
    }
    return result;
  }
}
