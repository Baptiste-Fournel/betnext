import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { WalletDebitPort } from '../../../shared-kernel/ports/WalletDebitPort';
import { WalletCreditPort } from '../../../shared-kernel/ports/WalletCreditPort';
import { WalletFunding } from '../application/ports/WalletFunding';
import { WalletLedgerView, WalletLedgerRow } from '../application/ports/WalletLedgerView';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Adapter en mémoire (mode sans DATABASE_URL / tests) : débit + crédit + ouverture + vue de
 * réconciliation partageant le MÊME état. C'est un **modèle de référence COHÉRENT** : chaque mutation
 * de solde enregistre un mouvement SIGNÉ déduplicé par opKey (mime la PK `wallet_operations`), si bien
 * que l'invariant Σ(mouvements) == solde tient **par construction** — ce modèle ne peut donc PAS
 * exhiber de dérive (la détection de dérive se prouve sur vrai Postgres : `reconciliation-pg`).
 *
 * Fidélité au chemin Postgres, avec une exception assumée :
 *  - CRÉDIT : refuse un wallet inexistant (lève) — miroir money-safety de l'adapter Postgres (BET-15) ;
 *  - DÉBIT : un wallet de **démo** touché sans ouverture explicite est seedé à `defaultBalance` AVEC son
 *    entrée d'ouverture (commodité de la démo sans `POST /wallet/open` ; sur Postgres l'ouverture est
 *    explicite). C'est la SEULE divergence, cantonnée au confort de démonstration.
 *  - débit et crédit sont exactement-une-fois (rejeu → no-op).
 */
export class InMemoryWalletAdapter
  implements WalletDebitPort, WalletCreditPort, WalletFunding, WalletLedgerView
{
  private readonly balances = new Map<string, number>();
  private readonly appliedOps = new Set<string>();
  private readonly movements: Array<{ userId: string; amount: number }> = [];

  constructor(private readonly defaultBalance = 100) {}

  async open(userId: string, openingBalance: number): Promise<boolean> {
    if (this.balances.has(userId)) {
      return false; // déjà ouvert → no-op (idempotent)
    }
    this.balances.set(userId, round2(openingBalance));
    this.record(`opening:${userId}`, userId, openingBalance);
    return true;
  }

  async debit(userId: string, amount: number, operationRef: string): Promise<void> {
    this.ensure(userId); // commodité démo : auto-ouverture du wallet joueur à defaultBalance
    const opKey = `stake:${operationRef}`;
    if (this.appliedOps.has(opKey)) {
      return; // exactement-une-fois
    }
    if (amount > this.balanceOf(userId)) {
      throw new DomainError('Insufficient balance');
    }
    this.balances.set(userId, round2(this.balanceOf(userId) - amount));
    this.record(opKey, userId, -amount);
  }

  async credit(userId: string, amount: number, opKey: string): Promise<void> {
    if (this.appliedOps.has(opKey)) {
      return; // exactement-une-fois (miroir de l'INSERT ON CONFLICT)
    }
    if (!this.balances.has(userId)) {
      // miroir money-safety du chemin Postgres : pas de crédit vers un wallet inexistant
      throw new DomainError('Wallet introuvable pour le crédit');
    }
    this.balances.set(userId, round2(this.balanceOf(userId) + amount));
    this.record(opKey, userId, amount);
  }

  async loadLedgerVsBalance(): Promise<WalletLedgerRow[]> {
    const sums = new Map<string, number>();
    for (const m of this.movements) {
      sums.set(m.userId, round2((sums.get(m.userId) ?? 0) + m.amount));
    }
    return [...this.balances.entries()].map(([userId, balance]) => ({
      userId,
      balance,
      ledgerSum: round2(sums.get(userId) ?? 0),
    }));
  }

  /** Seed paresseux d'un wallet de démo (defaultBalance) AVEC son entrée d'ouverture. */
  private ensure(userId: string): void {
    if (!this.balances.has(userId)) {
      this.balances.set(userId, round2(this.defaultBalance));
      if (this.defaultBalance !== 0) {
        this.record(`opening:${userId}`, userId, this.defaultBalance);
      }
    }
  }

  private record(opKey: string, userId: string, amount: number): void {
    if (this.appliedOps.has(opKey)) {
      return;
    }
    this.appliedOps.add(opKey);
    this.movements.push({ userId, amount: round2(amount) });
  }

  private balanceOf(userId: string): number {
    return this.balances.get(userId) ?? this.defaultBalance;
  }
}
