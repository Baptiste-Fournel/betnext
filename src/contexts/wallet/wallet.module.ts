import { Global, Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { WALLET_DEBIT_PORT, WalletDebitPort } from '../../shared-kernel/ports/WalletDebitPort';
import { WALLET_CREDIT_PORT, WalletCreditPort } from '../../shared-kernel/ports/WalletCreditPort';
import { TransactionContext } from '../../persistence/TransactionContext';
import { WALLET_FUNDING, WalletFunding } from './application/ports/WalletFunding';
import { WALLET_LEDGER_VIEW, WalletLedgerView } from './application/ports/WalletLedgerView';
import { OpenWallet } from './application/OpenWallet';
import { ReconcileWallets } from './application/ReconcileWallets';
import { TypeOrmWalletDebitAdapter } from './infrastructure/persistence/TypeOrmWalletDebitAdapter';
import { TypeOrmWalletCreditAdapter } from './infrastructure/persistence/TypeOrmWalletCreditAdapter';
import { TypeOrmWalletFundingAdapter } from './infrastructure/persistence/TypeOrmWalletFundingAdapter';
import { TypeOrmWalletReconciliationStore } from './infrastructure/persistence/TypeOrmWalletReconciliationStore';
import { InMemoryWalletAdapter } from './infrastructure/InMemoryWalletAdapter';
import { ReconciliationController } from './infrastructure/http/ReconciliationController';
import { WalletController } from './infrastructure/http/WalletController';

@Global()
@Module({
  controllers: [ReconciliationController, WalletController],
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
    {
      provide: WALLET_FUNDING,
      useFactory: (memory: InMemoryWalletAdapter, dataSource?: DataSource): WalletFunding =>
        dataSource ? new TypeOrmWalletFundingAdapter(dataSource) : memory,
      inject: [InMemoryWalletAdapter, { token: getDataSourceToken(), optional: true }],
    },
    {
      provide: WALLET_LEDGER_VIEW,
      useFactory: (memory: InMemoryWalletAdapter, dataSource?: DataSource): WalletLedgerView =>
        dataSource ? new TypeOrmWalletReconciliationStore(dataSource) : memory,
      inject: [InMemoryWalletAdapter, { token: getDataSourceToken(), optional: true }],
    },
    {
      provide: OpenWallet,
      useFactory: (funding: WalletFunding): OpenWallet => new OpenWallet(funding),
      inject: [WALLET_FUNDING],
    },
    {
      provide: ReconcileWallets,
      useFactory: (view: WalletLedgerView): ReconcileWallets => new ReconcileWallets(view),
      inject: [WALLET_LEDGER_VIEW],
    },
  ],
  exports: [WALLET_DEBIT_PORT, WALLET_CREDIT_PORT],
})
export class WalletModule {}
