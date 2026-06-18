export interface OutboxMessage {
  id: string;
  type: string;
  payload: string;
}

export interface QueuePort {
  enqueue(message: OutboxMessage): Promise<void>;
}
