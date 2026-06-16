import { OpenWallet } from './OpenWallet';
import { WalletFunding } from './ports/WalletFunding';

const fakeFunding = (): WalletFunding => {
  const opened = new Set<string>();
  return {
    open: async (userId: string): Promise<boolean> => {
      if (opened.has(userId)) return false;
      opened.add(userId);
      return true;
    },
  };
};

describe('OpenWallet (BET-15)', () => {
  it('ouvre un wallet (opened=true) puis no-op au rejeu (opened=false)', async () => {
    const uc = new OpenWallet(fakeFunding());
    expect((await uc.execute('u1', 50)).opened).toBe(true);
    expect((await uc.execute('u1', 50)).opened).toBe(false);
  });

  it("refuse un solde d'ouverture négatif", async () => {
    await expect(new OpenWallet(fakeFunding()).execute('u1', -1)).rejects.toThrow();
  });

  it('refuse un userId vide', async () => {
    await expect(new OpenWallet(fakeFunding()).execute('   ', 10)).rejects.toThrow();
  });
});
