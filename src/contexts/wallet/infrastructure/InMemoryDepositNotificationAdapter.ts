import {
  DepositCompensatedEvent,
  DepositNotificationPort,
} from '../application/ports/DepositNotificationPort';

// Notification en mémoire (mode POC sans DB / tests) : conserve les compensations émises. En prod
// (Postgres), c'est l'OutboxDepositNotificationAdapter (transactionnel) qui est branché.
export class InMemoryDepositNotificationAdapter implements DepositNotificationPort {
  readonly events: DepositCompensatedEvent[] = [];

  async notifyDepositCompensated(event: DepositCompensatedEvent): Promise<void> {
    this.events.push(event);
  }
}
