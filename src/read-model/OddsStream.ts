import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

/** Événement de cote en direct (payload du flux SSE). */
export interface OddsLiveEvent {
  outcomeId: string;
  odds: number;
}

/**
 * Flux IN-PROCESS des cotes : pont entre la PROJECTION (OddsUpdated → read-model) et le SSE. Le
 * projecteur PUBLIE ici à chaque OddsUpdated réellement consommé (donc alimenté par le vrai pipeline
 * async, PAS par du polling). L'endpoint @Sse s'y abonne. Singleton partagé projecteur ↔ SSE.
 * Complété au shutdown → pas de fuite (les abonnements par client sont fermés par Nest à la déconnexion).
 */
@Injectable()
export class OddsStream implements OnModuleDestroy {
  private readonly subject = new Subject<OddsLiveEvent>();

  publish(event: OddsLiveEvent): void {
    this.subject.next(event);
  }

  asObservable(): Observable<OddsLiveEvent> {
    return this.subject.asObservable();
  }

  onModuleDestroy(): void {
    this.subject.complete();
  }
}
