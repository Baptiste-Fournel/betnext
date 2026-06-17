import { randomUUID } from 'node:crypto';
import {
  DepositCompensatedEvent,
  DepositNotificationPort,
} from '../../application/ports/DepositNotificationPort';
import { TransactionContext } from '../../../../persistence/TransactionContext';

// Notification via Transactional Outbox (ADR-008). On écrit une ligne `outbox` par INSERT SQL brut
// DANS la transaction de compensation — sans importer l'entité OutboxRecord d'un autre contexte
// (frontières). Atomique avec le reverse : pas de reverse sans notif, pas de notif fantôme.
// Le relais publie ensuite vers la file (at-least-once, consommateur idempotent).
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
