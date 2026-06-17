import { BadRequestException, Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { OpenWallet } from '../../application/OpenWallet';
import { JwtAuthGuard } from '../../../../shared/auth/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/auth/roles.guard';
import { Roles } from '../../../../shared/auth/roles.decorator';

class OpenWalletRequest {
  @ApiProperty({ example: 'demo-player' })
  userId!: string;
  @ApiProperty({ example: 100, minimum: 0, description: "Solde d'ouverture (>= 0)" })
  openingBalance!: number;
}

class OpenWalletResultDto {
  @ApiProperty({ example: 'demo-player' })
  userId!: string;
  @ApiProperty({ example: true, description: 'false si le wallet existait déjà (idempotent)' })
  opened!: boolean;
}

interface OpenWalletBody {
  userId?: unknown;
  openingBalance?: unknown;
}

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MANAGER')
@Controller('wallet')
export class WalletController {
  constructor(private readonly openWallet: OpenWallet) {}

  @Post('open')
  @HttpCode(200)
  @ApiBody({ type: OpenWalletRequest })
  @ApiOkResponse({ type: OpenWalletResultDto })
  @ApiBadRequestResponse({ description: 'Corps invalide (userId/openingBalance)' })
  @ApiUnauthorizedResponse({ description: 'Token Bearer requis/invalide' })
  @ApiForbiddenResponse({ description: 'Réservé au rôle MANAGER' })
  @ApiUnprocessableEntityResponse({ description: "Solde d'ouverture invalide (doit être >= 0)" })
  async open(@Body() body: OpenWalletBody): Promise<OpenWalletResultDto> {
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const openingBalance = typeof body.openingBalance === 'number' ? body.openingBalance : NaN;
    const errors: string[] = [];
    if (!userId) errors.push('userId (string non vide) requis');
    if (!Number.isFinite(openingBalance)) errors.push('openingBalance (nombre) requis');
    if (errors.length > 0) throw new BadRequestException(errors);
    return this.openWallet.execute(userId, openingBalance);
  }
}
