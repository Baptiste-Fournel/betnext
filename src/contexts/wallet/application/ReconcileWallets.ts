import { WalletLedgerView } from './ports/WalletLedgerView';

/** Écart détecté sur un wallet : le solde stocké ne correspond pas à Σ(ledger). */
export interface WalletDrift {
  userId: string;
  /** Solde ATTENDU = Σ des mouvements (source autoritaire). */
  expectedBalance: number;
  /** Solde STOCKÉ (`wallets.balance`). */
  actualBalance: number;
  /** actual − expected (signé) : > 0 = solde en trop, < 0 = solde en moins. */
  difference: number;
}

/** Rapport de réconciliation (BET-15). Photographie : ne corrige RIEN, signale seulement. */
export interface ReconciliationReport {
  checkedAt: string; // ISO-8601
  walletsChecked: number;
  balanced: boolean;
  drifts: WalletDrift[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Réconciliation argent (BET-15) — FILET de la garantie « zéro perte ». Pour chaque wallet, compare
 * le solde stocké à la somme du ledger AUTORITAIRE (`wallet_operations`, ouverture incluse) et RAPPORTE
 * les écarts. Choix assumés :
 *  - SOURCE AUTORITAIRE EXPLICITE = le ledger `wallet_operations` (et non une estimation dérivée d'un
 *    autre contexte). La réconciliation reste donc ENTIÈREMENT dans le contexte Wallet (aucune lecture
 *    cross-contexte → frontière respectée).
 *  - PAS d'auto-correction : corriger de l'argent doit être une action revue, pas un effet de bord. Le
 *    job est en LECTURE SEULE → rejouable à l'infini sans rien changer ni double-rapporter (idempotent).
 *  - « En vol » ≠ dérive : chaque mouvement (débit/crédit/ouverture) est écrit dans la MÊME transaction
 *    que le solde ; l'asynchrone (Outbox/BullMQ) ne porte que des ÉVÉNEMENTS, jamais l'argent. Donc un
 *    règlement encore en file ou un Outbox non drainé n'a bougé NI le solde NI le ledger → l'invariant
 *    Σ == solde tient, aucun faux positif. L'instantané cohérent (une seule requête) ferme la dernière
 *    fenêtre (lecture déchirée solde/somme).
 */
export class ReconcileWallets {
  /** Tolérance sous le centime : `numeric(14,2)` n'a que 2 décimales, on évite le bruit flottant. */
  private static readonly EPSILON = 0.005;

  constructor(private readonly view: WalletLedgerView) {}

  async execute(): Promise<ReconciliationReport> {
    const rows = await this.view.loadLedgerVsBalance();
    const drifts: WalletDrift[] = [];
    for (const row of rows) {
      const difference = round2(row.balance - row.ledgerSum);
      if (Math.abs(difference) >= ReconcileWallets.EPSILON) {
        drifts.push({
          userId: row.userId,
          expectedBalance: round2(row.ledgerSum),
          actualBalance: round2(row.balance),
          difference,
        });
      }
    }
    return {
      checkedAt: new Date().toISOString(),
      walletsChecked: rows.length,
      balanced: drifts.length === 0,
      drifts,
    };
  }
}
