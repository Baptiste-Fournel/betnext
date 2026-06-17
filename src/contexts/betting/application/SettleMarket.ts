import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { WalletCreditPort } from '../../../shared-kernel/ports/WalletCreditPort';
import { Bet } from '../domain/Bet';
import { SettlementDecision } from '../domain/settlement/SettlementStrategy';
import { BetRepository } from './ports/BetRepository';
import { UnitOfWork } from './ports/UnitOfWork';
import { SettlementStrategyFactory } from './SettlementStrategyFactory';

export interface SettleMarketInput {
  outcomes: string[];
  winningOutcomeId: string | null;
  voided?: boolean;
  strategyKey?: string;
}

export interface SettleMarketResult {
  settled: number;
  failed: number;
  won: number;
  lost: number;
  voided: number;
  failedBetIds: string[];
}

export class SettleMarket {
  constructor(
    private readonly bets: BetRepository,
    private readonly credit: WalletCreditPort,
    private readonly factory: SettlementStrategyFactory,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(input: SettleMarketInput): Promise<SettleMarketResult> {
    const strategy = this.factory.resolve(input.strategyKey);
    const pending = await this.bets.findPendingByOutcomes(input.outcomes);
    const result: SettleMarketResult = {
      settled: 0,
      failed: 0,
      won: 0,
      lost: 0,
      voided: 0,
      failedBetIds: [],
    };

    for (const bet of pending) {
      try {
        const decision = strategy.decide(bet, {
          winningOutcomeId: input.winningOutcomeId,
          voided: input.voided ?? false,
        });
        await this.uow.withTransaction(async () => {
          this.apply(bet, decision);
          await this.bets.save(bet);
          if (decision.kind === 'WON') {
            await this.credit.credit(bet.userId, decision.payout, `payout:${bet.id}`);
          } else if (decision.kind === 'VOID') {
            await this.credit.credit(bet.userId, decision.payout, `refund:${bet.id}`);
          }
        });
        result.settled += 1;
        result.won += decision.kind === 'WON' ? 1 : 0;
        result.lost += decision.kind === 'LOST' ? 1 : 0;
        result.voided += decision.kind === 'VOID' ? 1 : 0;
      } catch {
        result.failed += 1;
        result.failedBetIds.push(bet.id);
      }
    }
    return result;
  }

  private apply(bet: Bet, decision: SettlementDecision): void {
    switch (decision.kind) {
      case 'WON':
        bet.win();
        break;
      case 'LOST':
        bet.lose();
        break;
      case 'VOID':
        bet.voidBet();
        break;
      default:
        throw new DomainError(
          `Règlement ${decision.kind} non supporté (type de pari non implémenté)`,
        );
    }
  }
}
