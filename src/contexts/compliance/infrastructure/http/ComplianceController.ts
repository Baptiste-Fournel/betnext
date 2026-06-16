import { BadRequestException, Body, Controller, Put } from '@nestjs/common';
import { SetDailyCap } from '../../application/SetDailyCap';

interface CapBody {
  userId?: unknown;
  cap?: unknown;
}

/** Adapter HTTP : le joueur définit son plafond quotidien (contexte Responsible Gaming). */
@Controller('responsible-gaming')
export class ComplianceController {
  constructor(private readonly setDailyCap: SetDailyCap) {}

  @Put('daily-cap')
  async set(@Body() body: CapBody): Promise<{ userId: string; dailyCap: number }> {
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const cap = typeof body.cap === 'number' ? body.cap : NaN;
    const errors: string[] = [];
    if (!userId) errors.push('userId (string non vide) requis');
    if (!Number.isFinite(cap)) errors.push('cap (nombre) requis');
    if (errors.length > 0) throw new BadRequestException(errors);
    await this.setDailyCap.execute(userId, cap);
    return { userId, dailyCap: cap };
  }
}
