import { Global, Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { WALLET_DEBIT_PORT, WalletDebitPort } from '../../shared-kernel/ports/WalletDebitPort';
import { WALLET_CREDIT_PORT, WalletCreditPort } from '../../shared-kernel/ports/WalletCreditPort';
import { TransactionContext } from '../../persistence/TransactionContext';
import { WALLET_FUNDING, WalletFunding } from './application/ports/WalletFunding';
import { WALLET_LEDGER_VIEW, WalletLedgerView } from './application/ports/WalletLedgerView';
import { WALLET_REFUND_PORT, WalletRefundPort } from './application/ports/WalletRefundPort';
import { WALLET_BALANCE_VIEW, WalletBalanceView } from './application/ports/WalletBalanceView';
import {
  DEPOSIT_NOTIFICATION_PORT,
  DepositNotificationPort,
} from './application/ports/DepositNotificationPort';
import { UNIT_OF_WORK, UnitOfWork } from './application/ports/UnitOfWork';
import { PAYMENT_GATEWAY, PaymentGateway } from './application/ports/PaymentGateway';
import { OpenWallet } from './application/OpenWallet';
import { ReconcileWallets } from './application/ReconcileWallets';
import { DepositFunds } from './application/DepositFunds';
import { TypeOrmWalletDebitAdapter } from './infrastructure/persistence/TypeOrmWalletDebitAdapter';
import { TypeOrmWalletCreditAdapter } from './infrastructure/persistence/TypeOrmWalletCreditAdapter';
import { TypeOrmWalletFundingAdapter } from './infrastructure/persistence/TypeOrmWalletFundingAdapter';
import { TypeOrmWalletReconciliationStore } from './infrastructure/persistence/TypeOrmWalletReconciliationStore';
import { TypeOrmWalletRefundAdapter } from './infrastructure/persistence/TypeOrmWalletRefundAdapter';
import { TypeOrmWalletBalanceView } from './infrastructure/persistence/TypeOrmWalletBalanceView';
import { TypeOrmWalletUnitOfWork } from './infrastructure/persistence/TypeOrmWalletUnitOfWork';
import { OutboxDepositNotificationAdapter } from './infrastructure/persistence/OutboxDepositNotificationAdapter';
import { InMemoryWalletAdapter } from './infrastructure/InMemoryWalletAdapter';
import { InMemoryDepositNotificationAdapter } from './infrastructure/InMemoryDepositNotificationAdapter';
import { StubPaymentGateway } from './infrastructure/payment/StubPaymentGateway';
import { StripePaymentGateway } from './infrastructure/payment/StripePaymentGateway';
import { ResilientPaymentGateway } from './infrastructure/payment/ResilientPaymentGateway';
import { CircuitBreaker } from '../../shared/resilience/circuit-breaker';
import { ReconciliationController } from './infrastructure/http/ReconciliationController';
import { WalletController } from './infrastructure/http/WalletController';
import { DepositController } from './infrastructure/http/DepositController';

// Sélection PSP par config (ENV), pattern Riot/esports : sans `STRIPE_SECRET_KEY` → stub
// déterministe (CI/démo hors-ligne, sans clé) ; avec → adapter Stripe RÉEL (mode test) durci par
// circuit breaker + timeout + retry. La clé n'est lue qu'ici et passée à l'adapter — jamais loggée.
const buildPaymentGateway = (): PaymentGateway => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return new StubPaymentGateway();
  }
  const breaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30_000 });
  return new ResilientPaymentGateway(new StripePaymentGateway(secret), breaker, {
    timeoutMs: 8_000,
    retries: 2,
    baseDelayMs: 300,
  });
};

@Global()
@Module({
  controllers: [ReconciliationController, WalletController, DepositController],
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
    // --- Dépôt par paiement externe (Stripe) : Saga + compensation (BET-17 / ADR-004) ---
    {
      provide: PAYMENT_GATEWAY,
      useFactory: (): PaymentGateway => buildPaymentGateway(),
    },
    {
      provide: UNIT_OF_WORK,
      useFactory: (context: TransactionContext, dataSource?: DataSource): UnitOfWork =>
        dataSource
          ? new TypeOrmWalletUnitOfWork(dataSource, context)
          : { withTransaction: <T>(work: () => Promise<T>): Promise<T> => work() },
      inject: [TransactionContext, { token: getDataSourceToken(), optional: true }],
    },
    {
      provide: WALLET_REFUND_PORT,
      useFactory: (
        context: TransactionContext,
        memory: InMemoryWalletAdapter,
        dataSource?: DataSource,
      ): WalletRefundPort => (dataSource ? new TypeOrmWalletRefundAdapter(context) : memory),
      inject: [
        TransactionContext,
        InMemoryWalletAdapter,
        { token: getDataSourceToken(), optional: true },
      ],
    },
    {
      provide: WALLET_BALANCE_VIEW,
      useFactory: (memory: InMemoryWalletAdapter, dataSource?: DataSource): WalletBalanceView =>
        dataSource ? new TypeOrmWalletBalanceView(dataSource) : memory,
      inject: [InMemoryWalletAdapter, { token: getDataSourceToken(), optional: true }],
    },
    {
      provide: DEPOSIT_NOTIFICATION_PORT,
      useFactory: (
        context: TransactionContext,
        dataSource?: DataSource,
      ): DepositNotificationPort =>
        dataSource
          ? new OutboxDepositNotificationAdapter(context)
          : new InMemoryDepositNotificationAdapter(),
      inject: [TransactionContext, { token: getDataSourceToken(), optional: true }],
    },
    {
      provide: DepositFunds,
      useFactory: (
        payment: PaymentGateway,
        uow: UnitOfWork,
        credit: WalletCreditPort,
        refund: WalletRefundPort,
        notifier: DepositNotificationPort,
      ): DepositFunds => new DepositFunds(payment, uow, credit, refund, notifier),
      inject: [
        PAYMENT_GATEWAY,
        UNIT_OF_WORK,
        WALLET_CREDIT_PORT,
        WALLET_REFUND_PORT,
        DEPOSIT_NOTIFICATION_PORT,
      ],
    },
  ],
  exports: [WALLET_DEBIT_PORT, WALLET_CREDIT_PORT],
})
export class WalletModule {}
