import { Global, Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { WALLET_DEBIT_PORT, WalletDebitPort } from '../../shared-kernel/ports/WalletDebitPort';
import { WALLET_CREDIT_PORT, WalletCreditPort } from '../../shared-kernel/ports/WalletCreditPort';
import { TransactionContext } from '../../persistence/TransactionContext';
import { TypeOrmWalletDebitAdapter } from './infrastructure/persistence/TypeOrmWalletDebitAdapter';
import { TypeOrmWalletCreditAdapter } from './infrastructure/persistence/TypeOrmWalletCreditAdapter';
import { InMemoryWalletAdapter } from './infrastructure/InMemoryWalletAdapter';

/**
 * Contexte Wallet. Expose en GLOBAL les ports PARTAGÉS débit + crédit (Shared Kernel) : Betting les
 * consomme sans importer ce module. Postgres si DATABASE_URL, sinon un adapter en mémoire UNIQUE
 * partagé débit/crédit (même solde). Le crédit est exactement-une-fois (BET-12).
 */
@Global()
@Module({
  providers: [
    {
      provide: InMemoryWalletAdapter,
      useFactory: (): InMemoryWalletAdapter => new InMemoryWalletAdapter(),
    },
    {
      provide: WALLET_DEBIT_PORT,
      useFactory: (
        context: TransactionContext,
        memory: InMemoryWalletAdapter,
        dataSource?: DataSource,
      ): WalletDebitPort => (dataSource ? new TypeOrmWalletDebitAdapter(context) : memory),
      inject: [
        TransactionContext,
        InMemoryWalletAdapter,
        { token: getDataSourceToken(), optional: true },
      ],
    },
    {
      provide: WALLET_CREDIT_PORT,
      useFactory: (
        context: TransactionContext,
        memory: InMemoryWalletAdapter,
        dataSource?: DataSource,
      ): WalletCreditPort => (dataSource ? new TypeOrmWalletCreditAdapter(context) : memory),
      inject: [
        TransactionContext,
        InMemoryWalletAdapter,
        { token: getDataSourceToken(), optional: true },
      ],
    },
  ],
  exports: [WALLET_DEBIT_PORT, WALLET_CREDIT_PORT],
})
export class WalletModule {}
