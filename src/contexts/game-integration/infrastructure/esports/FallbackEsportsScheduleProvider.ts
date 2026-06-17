import { Logger } from '@nestjs/common';
import {
  EsportsSchedule,
  EsportsScheduleProvider,
} from '../../application/ports/EsportsScheduleProvider';

// Garantit que le feed ne casse JAMAIS l'app : tente la source live (réelle), bascule sur les
// fixtures à la moindre erreur (timeout/HTTP/réseau) et SIGNALE le mode dégradé via `source`.
// Ne logge jamais la clé ni l'URL : seul l'événement de bascule est tracé.
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
