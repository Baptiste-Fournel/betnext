import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ReconcileWallets, ReconciliationReport } from '../../application/ReconcileWallets';
import { JwtAuthGuard } from '../../../../shared/auth/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/auth/roles.guard';
import { Roles } from '../../../../shared/auth/roles.decorator';

class WalletDriftDto {
  @ApiProperty({ example: 'demo-player' })
  userId!: string;
  @ApiProperty({
    type: Number,
    example: 80,
    description: 'Σ(ledger) = solde attendu (autoritaire)',
  })
  expectedBalance!: number;
  @ApiProperty({ type: Number, example: 130, description: 'wallets.balance (stocké)' })
  actualBalance!: number;
  @ApiProperty({ type: Number, example: 50, description: 'actual − expected (signé)' })
  difference!: number;
}

class ReconciliationReportDto {
  @ApiProperty({ example: '2026-06-16T10:00:00.000Z' })
  checkedAt!: string;
  @ApiProperty({ type: Number, example: 3 })
  walletsChecked!: number;
  @ApiProperty({ example: true, description: 'true si aucun écart détecté' })
  balanced!: boolean;
  @ApiProperty({ type: [WalletDriftDto], description: 'wallets en dérive (vide si balanced)' })
  drifts!: WalletDriftDto[];
}

/**
 * Réconciliation argent SUR DEMANDE (BET-15) — réservée au rôle **MANAGER** (BET-20) : le rapport
 * expose les soldes/écarts de TOUS les wallets (donnée sensible d'exploitation). Lecture seule,
 * idempotent, AUCUNE auto-correction.
 */
@ApiTags('reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MANAGER')
@Controller('admin')
export class ReconciliationController {
  constructor(private readonly reconcile: ReconcileWallets) {}

  @Get('reconciliation')
  @ApiOkResponse({
    type: ReconciliationReportDto,
    description: 'Rapport de réconciliation (MANAGER)',
  })
  @ApiUnauthorizedResponse({ description: 'Token Bearer requis/invalide' })
  @ApiForbiddenResponse({ description: 'Réservé au rôle MANAGER' })
  run(): Promise<ReconciliationReport> {
    return this.reconcile.execute();
  }
}
