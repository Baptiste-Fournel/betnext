import {
  DepositCompensatedEvent,
  DepositNotificationPort,
} from '../application/ports/DepositNotificationPort';

export class InMemoryDepositNotificationAdapter implements DepositNotificationPort {
  readonly events: DepositCompensatedEvent[] = [];

  async notifyDepositCompensated(event: DepositCompensatedEvent): Promise<void> {
    this.events.push(event);
  }
}
