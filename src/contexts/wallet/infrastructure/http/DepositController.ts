import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { DepositFunds } from '../../application/DepositFunds';
import { WALLET_BALANCE_VIEW, WalletBalanceView } from '../../application/ports/WalletBalanceView';
import { JwtAuthGuard } from '../../../../shared/auth/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import { AuthUser } from '../../../../shared/auth/auth-user';

class DepositRequest {
  @ApiProperty({ example: 50, minimum: 0, description: 'Montant à déposer (euros, > 0)' })
  amount!: number;
}

class DepositResultDto {
  @ApiProperty({ example: 'b1f2c3d4', description: "Identifiant du dépôt (= clé d'idempotence)" })
  depositId!: string;
  @ApiProperty({
    example: 'stub_ch_deposit:b1f2c3d4',
    description: 'Référence opaque de la charge',
  })
  chargeId!: string;
  @ApiProperty({ example: 50 })
  amount!: number;
  @ApiProperty({ example: 'CREDITED', enum: ['CREDITED'] })
  status!: string;
}

class BalanceDto {
  @ApiProperty({ example: 'demo-player' })
  userId!: string;
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 150,
    description: 'Solde courant (null si wallet inexistant)',
  })
  balance!: number | null;
}

interface DepositBody {
  amount?: unknown;
}

@ApiTags('wallet')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token Bearer requis/invalide' })
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class DepositController {
  constructor(
    private readonly depositFunds: DepositFunds,
    @Inject(WALLET_BALANCE_VIEW) private readonly balanceView: WalletBalanceView,
  ) {}

  @Post('deposit')
  @HttpCode(201)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clé par tentative, réutilisée au retry (anti double-charge/double-crédit).',
  })
  @ApiBody({ type: DepositRequest })
  @ApiCreatedResponse({
    type: DepositResultDto,
    description: 'Fonds crédités (charge PSP réussie)',
  })
  @ApiBadRequestResponse({ description: 'Idempotency-Key ou montant invalide' })
  @ApiUnprocessableEntityResponse({
    description: 'Dépôt impossible : paiement remboursé (compensation)',
  })
  async deposit(
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: DepositBody,
  ): Promise<DepositResultDto> {
    const depositId = idempotencyKey?.trim();
    if (!depositId) {
      throw new BadRequestException("Header 'Idempotency-Key' requis");
    }
    const amount = typeof body.amount === 'number' ? body.amount : NaN;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amount (nombre > 0) requis');
    }
    return this.depositFunds.execute({ userId: user.userId, amount, depositId });
  }

  @Get('balance')
  @ApiOkResponse({ type: BalanceDto, description: 'Solde du joueur authentifié' })
  async balance(@CurrentUser() user: AuthUser): Promise<BalanceDto> {
    const balance = await this.balanceView.balanceOf(user.userId);
    return { userId: user.userId, balance };
  }
}
