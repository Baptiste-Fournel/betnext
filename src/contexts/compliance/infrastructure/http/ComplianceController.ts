import { BadRequestException, Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { SetDailyCap } from '../../application/SetDailyCap';
import { GetDailyCap } from '../../application/GetDailyCap';
import { JwtAuthGuard } from '../../../../shared/auth/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import { AuthUser } from '../../../../shared/auth/auth-user';

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

/** Corps de PUT /responsible-gaming/daily-cap : le cap seulement (le userId vient du token). */
class SetDailyCapRequest {
  @ApiProperty({ example: 50, minimum: 0, description: 'Plafond quotidien (> 0)' })
  cap!: number;
}

interface CapBody {
  cap?: unknown;
}

/**
 * Adapter HTTP (BET-20) : AUTHENTIFIÉ. Le joueur consulte (GET) et définit (PUT) SON PROPRE plafond.
 * Le `userId` vient TOUJOURS du token (jamais du corps/query) → un joueur ne peut agir que sur son
 * propre plafond (pas d'IDOR).
 */
@ApiTags('responsible-gaming')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token Bearer requis/invalide' })
@UseGuards(JwtAuthGuard)
@Controller('responsible-gaming')
export class ComplianceController {
  constructor(
    private readonly setDailyCap: SetDailyCap,
    private readonly getDailyCap: GetDailyCap,
  ) {}

  @Get('daily-cap')
  @ApiOkResponse({ type: DailyCapDto })
  async get(@CurrentUser() user: AuthUser): Promise<DailyCapDto> {
    return { userId: user.userId, dailyCap: await this.getDailyCap.execute(user.userId) };
  }

  @Put('daily-cap')
  @ApiBody({ type: SetDailyCapRequest })
  @ApiOkResponse({ type: DailyCapDto })
  @ApiBadRequestResponse({ description: 'Corps invalide (cap)' })
  @ApiUnprocessableEntityResponse({ description: 'Plafond invalide (doit être > 0)' })
  async set(@CurrentUser() user: AuthUser, @Body() body: CapBody): Promise<DailyCapDto> {
    const cap = typeof body.cap === 'number' ? body.cap : NaN;
    if (!Number.isFinite(cap)) {
      throw new BadRequestException('cap (nombre) requis');
    }
    await this.setDailyCap.execute(user.userId, cap);
    return { userId: user.userId, dailyCap: cap };
  }
}
