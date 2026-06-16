import { InMemoryWalletAdapter } from './InMemoryWalletAdapter';
import { ReconcileWallets } from '../application/ReconcileWallets';

describe('InMemoryWalletAdapter — ledger complet (BET-15), miroir de Postgres', () => {
  it('maintient Σ(mouvements) == solde après open/debit/credit', async () => {
    const w = new InMemoryWalletAdapter(0);
    await w.open('u1', 100);
    await w.debit('u1', 20, 'bet-1'); // -20
    await w.credit('u1', 40, 'payout:bet-1'); // +40
    const u1 = (await w.loadLedgerVsBalance()).find((r) => r.userId === 'u1')!;
    expect(u1.balance).toBe(120);
    expect(u1.ledgerSum).toBe(120);
    expect((await new ReconcileWallets(w).execute()).balanced).toBe(true);
  });

  it('débit exactement-une-fois : rejeu de la même réf ne re-débite pas (invariant tenu)', async () => {
    const w = new InMemoryWalletAdapter(0);
    await w.open('u1', 100);
    await w.debit('u1', 30, 'bet-1');
    await w.debit('u1', 30, 'bet-1'); // rejeu
    const u1 = (await w.loadLedgerVsBalance())[0];
    expect(u1.balance).toBe(70);
    expect(u1.ledgerSum).toBe(70);
  });

  it('seed paresseux : un wallet de démo touché sans ouverture explicite reste balanced', async () => {
    const w = new InMemoryWalletAdapter(100); // solde de démo par défaut
    await w.debit('demo', 20, 'bet-9'); // ensure() seede 100 + entrée d'ouverture
    expect((await new ReconcileWallets(w).execute()).balanced).toBe(true);
    const u = (await w.loadLedgerVsBalance())[0];
    expect(u.balance).toBe(80);
    expect(u.ledgerSum).toBe(80);
  });

  it('open idempotent : ré-ouverture = no-op, reste balanced', async () => {
    const w = new InMemoryWalletAdapter(0);
    expect(await w.open('u1', 100)).toBe(true);
    expect(await w.open('u1', 999)).toBe(false);
    expect((await new ReconcileWallets(w).execute()).balanced).toBe(true);
    expect((await w.loadLedgerVsBalance())[0].balance).toBe(100);
  });

  it('crédit vers un wallet NON ouvert → lève (miroir money-safety du chemin Postgres)', async () => {
    const w = new InMemoryWalletAdapter(0);
    await expect(w.credit('ghost', 40, 'payout:x')).rejects.toThrow();
    // aucun wallet ni mouvement créé → pas de dérive fantôme
    expect(await w.loadLedgerVsBalance()).toEqual([]);
  });
});
