import { BadRequestException, Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { SettleMarketCommand } from '../../application/SettleMarketCommand';
import { SettleMarketResult } from '../../application/SettleMarket';

interface SettleBody {
  outcomes?: unknown;
  winningOutcomeId?: unknown;
  voided?: unknown;
  strategyKey?: unknown;
}

/**
 * Adapter HTTP de RÈGLEMENT, déclenché par le GESTIONNAIRE à la clôture d'un marché.
 * HYPOTHÈSE NON VALIDÉE (signalée) : ici le résultat est publié par le manager via cet endpoint ;
 * l'alternative est un event de Game Integration consommé sur le bus — la couture (SettleMarket)
 * reste identique, seul l'adapter d'entrée changerait.
 */
@Controller('markets')
export class SettlementController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('settle')
  @HttpCode(200)
  settle(@Body() body: SettleBody): Promise<SettleMarketResult> {
    const { outcomes, winningOutcomeId, voided, strategyKey } = this.validate(body);
    return this.commandBus.execute<SettleMarketCommand, SettleMarketResult>(
      new SettleMarketCommand(outcomes, winningOutcomeId, voided, strategyKey),
    );
  }

  private validate(body: SettleBody): {
    outcomes: string[];
    winningOutcomeId: string | null;
    voided: boolean;
    strategyKey?: string;
  } {
    const outcomes =
      Array.isArray(body.outcomes) &&
      body.outcomes.every((o) => typeof o === 'string' && o.trim() !== '')
        ? (body.outcomes as string[])
        : [];
    const voided = body.voided === true;
    const winningOutcomeId =
      typeof body.winningOutcomeId === 'string' && body.winningOutcomeId.trim() !== ''
        ? body.winningOutcomeId.trim()
        : null;
    const strategyKey =
      typeof body.strategyKey === 'string' && body.strategyKey.trim() !== ''
        ? body.strategyKey.trim()
        : undefined;

    const errors: string[] = [];
    if (outcomes.length === 0) errors.push('outcomes (string[] non vide) requis');
    if (!voided && winningOutcomeId === null)
      errors.push('winningOutcomeId requis si voided=false');
    if (errors.length > 0) throw new BadRequestException(errors);

    return { outcomes, winningOutcomeId, voided, strategyKey };
  }
}
