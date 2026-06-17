export const DEPOSIT_NOTIFICATION_PORT = Symbol('DepositNotificationPort');

export type DepositCompensationReason = 'CREDIT_FAILED' | 'DOWNSTREAM_FAILED';

export interface DepositCompensatedEvent {
  userId: string;
  depositId: string;
  amount: number;
  reason: DepositCompensationReason;
}

// Notifie l'utilisateur qu'un dépôt a été compensé (remboursé). Écrit DANS la transaction de
// compensation (Outbox transactionnel) → la notif est commitée atomiquement avec le reverse :
// pas de reverse sans notif, pas de notif fantôme. Au moins une fois (consommateur idempotent).
export interface DepositNotificationPort {
  notifyDepositCompensated(event: DepositCompensatedEvent): Promise<void>;
}
