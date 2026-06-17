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
  it('shouldOpenThenNoOp_WhenSameUserOpenedTwice', async () => {
    // Arrange
    const uc = new OpenWallet(fakeFunding());

    // Act / Assert
    expect((await uc.execute('u1', 50)).opened).toBe(true);
    expect((await uc.execute('u1', 50)).opened).toBe(false);
  });

  it('shouldThrow_WhenOpeningBalanceNegative', async () => {
    // Act / Assert
    await expect(new OpenWallet(fakeFunding()).execute('u1', -1)).rejects.toThrow();
  });

  it('shouldThrow_WhenUserIdEmpty', async () => {
    // Act / Assert
    await expect(new OpenWallet(fakeFunding()).execute('   ', 10)).rejects.toThrow();
  });
});
