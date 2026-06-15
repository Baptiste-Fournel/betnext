/** Événement de domaine immuable (journal append-only / audit — ADR-005). */
export interface DomainEvent {
  readonly type: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
}
