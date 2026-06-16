import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { ReconcileWallets, ReconciliationReport } from '../../application/ReconcileWallets';

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
 * Réconciliation argent SUR DEMANDE (BET-15) : produit un RAPPORT (Σ ledger vs solde) pour chaque
 * wallet. Lecture seule, idempotent, AUCUNE auto-correction (une dérive se signale, elle ne se corrige
 * pas en douce). Schedulable plus tard sans changement (mêmes garanties).
 */
@ApiTags('reconciliation')
@Controller('admin')
export class ReconciliationController {
  constructor(private readonly reconcile: ReconcileWallets) {}

  @Get('reconciliation')
  @ApiOkResponse({ type: ReconciliationReportDto, description: 'Rapport de réconciliation' })
  run(): Promise<ReconciliationReport> {
    return this.reconcile.execute();
  }
}
