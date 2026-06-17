import { randomUUID } from 'node:crypto';
import {
  DepositCompensatedEvent,
  DepositNotificationPort,
} from '../../application/ports/DepositNotificationPort';
import { TransactionContext } from '../../../../persistence/TransactionContext';

export class OutboxDepositNotificationAdapter implements DepositNotificationPort {
  constructor(private readonly context: TransactionContext) {}

  async notifyDepositCompensated(event: DepositCompensatedEvent): Promise<void> {
    const manager = this.context.getManager();
    if (!manager) {
      throw new Error(
        'notifyDepositCompensated doit être appelé dans une transaction (UnitOfWork)',
      );
    }
    await manager.query('INSERT INTO outbox ("id", "type", "payload") VALUES ($1, $2, $3)', [
      randomUUID(),
      'DepositCompensated',
      JSON.stringify(event),
    ]);
  }
}
