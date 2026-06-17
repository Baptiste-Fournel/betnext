import { SyncMatchResult } from './SyncMatchResult';
import { GameProvider } from './ports/GameProvider';
import { MatchLink, MatchLinkStore } from './ports/MatchLinkStore';
import { MatchReport } from '../domain/MatchReport';
import {
  MarketSettlementPort,
  SettlementRequest,
  SettlementSummary,
} from '../../../shared-kernel/ports/MarketSettlementPort';

const link: MatchLink = {
  matchId: 'EUW1_42',
  outcomes: ['o-a', 'o-b', 'o-draw'],
  mapping: { HOME: 'o-a', AWAY: 'o-b', DRAW: 'o-draw' },
};
const linkStore = (l: MatchLink | null): MatchLinkStore => ({
  save: async () => undefined,
  find: async () => l,
});
const provider = (report: MatchReport): GameProvider => ({
  fetchMatchReport: async () => report,
});
const recordingSettlement = (): MarketSettlementPort & { calls: SettlementRequest[] } => {
  const calls: SettlementRequest[] = [];
  const summary: SettlementSummary = { settled: 1, won: 1, lost: 0, voided: 0, failed: 0 };
  return {
    calls,
    settle: async (req) => {
      calls.push(req);
      return summary;
    },
  };
};

describe('SyncMatchResult (BET-21)', () => {
  it('shouldSettleMarketOnMappedOutcomeNotVoided_WhenMatchFinishedWithHomeWinner', async () => {
    // Arrange
    const settlement = recordingSettlement();

    // Act
    const res = await new SyncMatchResult(
      provider({ matchId: 'EUW1_42', status: 'FINISHED', winner: 'HOME' }),
      linkStore(link),
      settlement,
    ).execute('EUW1_42');

    // Assert
    expect(res).toMatchObject({
      status: 'SETTLED',
      resolution: 'WON_OUTCOME',
      winningOutcomeId: 'o-a',
    });
    expect(settlement.calls).toEqual([
      { outcomes: link.outcomes, winningOutcomeId: 'o-a', voided: false },
    ]);
  });

  it('shouldNotSettleMarket_WhenMatchStillPending', async () => {
    // Arrange
    const settlement = recordingSettlement();

    // Act
    const res = await new SyncMatchResult(
      provider({ matchId: 'EUW1_42', status: 'PENDING', winner: null }),
      linkStore(link),
      settlement,
    ).execute('EUW1_42');

    // Assert
    expect(res.status).toBe('PENDING');
    expect(settlement.calls).toHaveLength(0);
  });

  it('shouldVoidMarketAndRefund_WhenDrawResultButNoDrawOutcomeMapped', async () => {
    // Arrange
    const settlement = recordingSettlement();
    const twoWay: MatchLink = {
      matchId: 'm',
      outcomes: ['o-a', 'o-b'],
      mapping: { HOME: 'o-a', AWAY: 'o-b' },
    };

    // Act
    const res = await new SyncMatchResult(
      provider({ matchId: 'm', status: 'FINISHED', winner: 'DRAW' }),
      linkStore(twoWay),
      settlement,
    ).execute('m');

    // Assert
    expect(res).toMatchObject({ status: 'SETTLED', resolution: 'VOIDED' });
    expect(settlement.calls).toEqual([
      { outcomes: twoWay.outcomes, winningOutcomeId: null, voided: true },
    ]);
  });

  it('shouldThrow_WhenMatchNotLinked', async () => {
    // Act / Assert
    await expect(
      new SyncMatchResult(
        provider({ matchId: 'x', status: 'FINISHED', winner: 'HOME' }),
        linkStore(null),
        recordingSettlement(),
      ).execute('x'),
    ).rejects.toThrow();
  });
});
