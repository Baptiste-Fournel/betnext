import { Global, Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { WALLET_DEBIT_PORT, WalletDebitPort } from '../../shared-kernel/ports/WalletDebitPort';
import { TransactionContext } from '../../persistence/TransactionContext';
import { TypeOrmWalletDebitAdapter } from './infrastructure/persistence/TypeOrmWalletDebitAdapter';
import { InMemoryWalletDebitAdapter } from './infrastructure/InMemoryWalletDebitAdapter';

/**
 * Contexte Wallet. Expose en GLOBAL le port de débit partagé (Shared Kernel) : Betting le
 * consomme sans importer ce module. Postgres si DATABASE_URL, sinon en mémoire.
 */
@Global()
@Module({
  providers: [
    {
      provide: WALLET_DEBIT_PORT,
      useFactory: (context: TransactionContext, dataSource?: DataSource): WalletDebitPort =>
        dataSource ? new TypeOrmWalletDebitAdapter(context) : new InMemoryWalletDebitAdapter(),
      inject: [TransactionContext, { token: getDataSourceToken(), optional: true }],
    },
  ],
  exports: [WALLET_DEBIT_PORT],
})
export class WalletModule {}
