import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export interface OddsLiveEvent {
  outcomeId: string;
  odds: number;
}

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
