import { OutboxMessage, QueuePort } from './QueuePort';

type Handler = (message: OutboxMessage) => Promise<void>;

export class InMemoryEventBus {
  private readonly handlers = new Map<string, Handler[]>();

  publisherFor(topic: string): QueuePort {
    return { enqueue: (message: OutboxMessage) => this.publish(topic, message) };
  }

  subscribe(topic: string, handler: Handler): void {
    const list = this.handlers.get(topic) ?? [];
    list.push(handler);
    this.handlers.set(topic, list);
  }

  async publish(topic: string, message: OutboxMessage): Promise<void> {
    for (const handler of this.handlers.get(topic) ?? []) {
      await handler(message);
    }
  }
}
