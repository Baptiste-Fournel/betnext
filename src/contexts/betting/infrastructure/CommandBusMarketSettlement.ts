import { CommandBus } from '@nestjs/cqrs';
import {
  MarketSettlementPort,
  SettlementRequest,
  SettlementSummary,
} from '../../../shared-kernel/ports/MarketSettlementPort';
import { SettleMarketCommand } from '../application/SettleMarketCommand';
import { SettleMarketResult } from '../application/SettleMarket';

/**
 * Implémentation Betting du port partagé `MarketSettlementPort` : règle via la couture existante
 * (SettleMarketCommand → SettleMarket, BET-12) — donc EXACTEMENT-UNE-FOIS / idempotent par
 * construction (seuls les paris EN ATTENTE sont réglés ; un rejeu ne double rien). Game Integration
 * consomme ce port sans connaître l'intérieur de Betting.
 */
export class CommandBusMarketSettlement implements MarketSettlementPort {
  constructor(private readonly commandBus: CommandBus) {}

  async settle(request: SettlementRequest): Promise<SettlementSummary> {
    const result = await this.commandBus.execute<SettleMarketCommand, SettleMarketResult>(
      new SettleMarketCommand(request.outcomes, request.winningOutcomeId, request.voided),
    );
    return {
      settled: result.settled,
      won: result.won,
      lost: result.lost,
      voided: result.voided,
      failed: result.failed,
    };
  }
}
