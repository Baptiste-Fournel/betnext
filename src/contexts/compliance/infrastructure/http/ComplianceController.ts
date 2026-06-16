import { BadRequestException, Body, Controller, Get, Put, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiProperty,
  ApiQuery,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { SetDailyCap } from '../../application/SetDailyCap';
import { GetDailyCap } from '../../application/GetDailyCap';

/** Plafond quotidien du joueur (Responsible Gaming). `dailyCap` null = aucun plafond défini. */
class DailyCapDto {
  @ApiProperty({ example: 'demo-player' })
  userId!: string;
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 50,
    description: 'null si aucun plafond défini',
  })
  dailyCap!: number | null;
}

/** Corps de PUT /responsible-gaming/daily-cap (exposé au contrat). */
class SetDailyCapRequest {
  @ApiProperty({ example: 'demo-player' })
  userId!: string;
  @ApiProperty({ example: 50, minimum: 0, description: 'Plafond quotidien (> 0)' })
  cap!: number;
}

interface CapBody {
  userId?: unknown;
  cap?: unknown;
}

/** Adapter HTTP : le joueur consulte (GET) et définit (PUT) son plafond quotidien. */
@ApiTags('responsible-gaming')
@Controller('responsible-gaming')
export class ComplianceController {
  constructor(
    private readonly setDailyCap: SetDailyCap,
    private readonly getDailyCap: GetDailyCap,
  ) {}

  @Get('daily-cap')
  @ApiQuery({ name: 'userId', required: true, example: 'demo-player' })
  @ApiOkResponse({ type: DailyCapDto })
  @ApiBadRequestResponse({ description: 'query userId manquant' })
  async get(@Query('userId') userId?: string): Promise<DailyCapDto> {
    const id = typeof userId === 'string' ? userId.trim() : '';
    if (!id) {
      throw new BadRequestException('query userId requis');
    }
    return { userId: id, dailyCap: await this.getDailyCap.execute(id) };
  }

  @Put('daily-cap')
  @ApiBody({ type: SetDailyCapRequest })
  @ApiOkResponse({ type: DailyCapDto })
  @ApiBadRequestResponse({ description: 'Corps invalide (userId/cap)' })
  @ApiUnprocessableEntityResponse({ description: 'Plafond invalide (doit être > 0)' })
  async set(@Body() body: CapBody): Promise<DailyCapDto> {
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
