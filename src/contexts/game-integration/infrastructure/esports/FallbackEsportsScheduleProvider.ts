import { Logger } from '@nestjs/common';
import {
  EsportsSchedule,
  EsportsScheduleProvider,
} from '../../application/ports/EsportsScheduleProvider';

export class FallbackEsportsScheduleProvider implements EsportsScheduleProvider {
  private readonly logger = new Logger(FallbackEsportsScheduleProvider.name);

  constructor(
    private readonly primary: EsportsScheduleProvider,
    private readonly fallback: EsportsScheduleProvider,
  ) {}

  async fetchUpcoming(): Promise<EsportsSchedule> {
    try {
      return await this.primary.fetchUpcoming();
    } catch {
      this.logger.warn('Source LoL Esports injoignable — bascule sur les fixtures (mode dégradé).');
      return this.fallback.fetchUpcoming();
    }
  }
}
