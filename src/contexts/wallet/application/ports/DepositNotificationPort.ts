export const DEPOSIT_NOTIFICATION_PORT = Symbol('DepositNotificationPort');

export type DepositCompensationReason = 'CREDIT_FAILED' | 'DOWNSTREAM_FAILED';

export interface DepositCompensatedEvent {
  userId: string;
  depositId: string;
  amount: number;
  reason: DepositCompensationReason;
}

export interface DepositNotificationPort {
  notifyDepositCompensated(event: DepositCompensatedEvent): Promise<void>;
}
