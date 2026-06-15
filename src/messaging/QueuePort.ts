/** Port de file (sortie du relais Outbox). Implémenté par BullMQ ; mockable en test unitaire. */
export const QUEUE_PORT = Symbol('QueuePort');

export interface OutboxMessage {
  id: string;
  type: string;
  payload: string;
}

export interface QueuePort {
  enqueue(message: OutboxMessage): Promise<void>;
}
