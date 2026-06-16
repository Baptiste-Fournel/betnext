import { Global, Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { STAKE_GUARD_PORT, StakeGuardPort } from '../../shared-kernel/ports/StakeGuardPort';
import { TransactionContext } from '../../persistence/TransactionContext';
import { COMPLIANCE_STORE, ComplianceStore } from './application/ports/ComplianceStore';
import {
  CompliancePolicyRegistry,
  COMPLIANCE_POLICIES,
} from './application/CompliancePolicyRegistry';
import { CompliancePolicy } from './domain/CompliancePolicy';
import { DailyCapPolicy } from './domain/DailyCapPolicy';
import { ReserveStake } from './application/ReserveStake';
import { SetDailyCap } from './application/SetDailyCap';
import { TypeOrmComplianceStore } from './infrastructure/TypeOrmComplianceStore';
import { InMemoryComplianceStore } from './infrastructure/InMemoryComplianceStore';
import { ComplianceController } from './infrastructure/http/ComplianceController';

/**
 * Contexte Responsible Gaming (ADR-010). Expose en GLOBAL le port partagé StakeGuardPort : Betting
 * le consomme sans importer ce module. Règles enfichables via le registre (DailyCapPolicy = 1re).
 * Postgres si DATABASE_URL, sinon en mémoire.
 */
@Global()
@Module({
  controllers: [ComplianceController],
  providers: [
    // Point d'extension Open/Closed : ajouter une règle = un fichier de policy + 1 entrée ICI.
    { provide: COMPLIANCE_POLICIES, useFactory: (): CompliancePolicy[] => [new DailyCapPolicy()] },
    {
      provide: CompliancePolicyRegistry,
      useFactory: (policies: CompliancePolicy[]): CompliancePolicyRegistry =>
        new CompliancePolicyRegistry(policies),
      inject: [COMPLIANCE_POLICIES],
    },
    {
      provide: COMPLIANCE_STORE,
      useFactory: (context: TransactionContext, dataSource?: DataSource): ComplianceStore =>
        dataSource
          ? new TypeOrmComplianceStore(dataSource, context)
          : new InMemoryComplianceStore(),
      inject: [TransactionContext, { token: getDataSourceToken(), optional: true }],
    },
    {
      provide: STAKE_GUARD_PORT,
      useFactory: (store: ComplianceStore, registry: CompliancePolicyRegistry): StakeGuardPort =>
        new ReserveStake(store, registry),
      inject: [COMPLIANCE_STORE, CompliancePolicyRegistry],
    },
    {
      provide: SetDailyCap,
      useFactory: (store: ComplianceStore): SetDailyCap => new SetDailyCap(store),
      inject: [COMPLIANCE_STORE],
    },
  ],
  exports: [STAKE_GUARD_PORT],
})
export class ComplianceModule {}
