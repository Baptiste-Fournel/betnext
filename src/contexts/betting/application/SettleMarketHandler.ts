import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SettleMarketCommand } from './SettleMarketCommand';
import { SettleMarket, SettleMarketResult } from './SettleMarket';

@CommandHandler(SettleMarketCommand)
export class SettleMarketHandler implements ICommandHandler<
  SettleMarketCommand,
  SettleMarketResult
> {
  constructor(private readonly settle: SettleMarket) {}

  execute(command: SettleMarketCommand): Promise<SettleMarketResult> {
    return this.settle.execute({
      outcomes: command.outcomes,
      winningOutcomeId: command.winningOutcomeId,
      voided: command.voided,
      strategyKey: command.strategyKey,
    });
  }
}
