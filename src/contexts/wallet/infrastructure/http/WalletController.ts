import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { OpenWallet } from '../../application/OpenWallet';

/** Corps d'ouverture/alimentation d'un wallet (écrit l'entrée d'ouverture du ledger). */
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

/**
 * Ouverture/alimentation d'un wallet (POC, sans auth — dette tracée comme partout). Écriture NORMALE :
 * validation simple du corps. Le solde et l'entrée d'ouverture du ledger sont écrits atomiquement par
 * l'adapter, et l'opération est idempotente (ré-ouverture → opened=false).
 */
@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly openWallet: OpenWallet) {}

  @Post('open')
  @ApiBody({ type: OpenWalletRequest })
  @ApiOkResponse({ type: OpenWalletResultDto })
  @ApiBadRequestResponse({ description: 'Corps invalide (userId/openingBalance)' })
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
