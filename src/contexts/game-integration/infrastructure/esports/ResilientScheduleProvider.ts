import {
  EsportsSchedule,
  EsportsScheduleProvider,
} from '../../application/ports/EsportsScheduleProvider';
import { withRetry } from '../resilience/with-retry';
import { withTimeout } from '../resilience/with-timeout';

export interface ScheduleResilienceOptions {
  timeoutMs: number;
  retries: number;
  baseDelayMs: number;
}

export class ResilientScheduleProvider implements EsportsScheduleProvider {
  constructor(
    private readonly inner: EsportsScheduleProvider,
    private readonly options: ScheduleResilienceOptions,
  ) {}

  fetchUpcoming(): Promise<EsportsSchedule> {
    return withRetry(() => withTimeout(() => this.inner.fetchUpcoming(), this.options.timeoutMs), {
      retries: this.options.retries,
      baseDelayMs: this.options.baseDelayMs,
    });
  }
}
