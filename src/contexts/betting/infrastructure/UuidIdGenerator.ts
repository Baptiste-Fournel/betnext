import { randomUUID } from 'node:crypto';
import { IdGenerator } from '../application/ports/IdGenerator';

export class UuidIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
