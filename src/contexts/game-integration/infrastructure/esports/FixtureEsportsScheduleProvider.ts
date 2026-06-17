import {
  EsportsSchedule,
  EsportsScheduleProvider,
  ScheduledMatch,
} from '../../application/ports/EsportsScheduleProvider';

// Adapter de repli : vraies équipes/ligues, dates proches calculées à la volée. Sert les tests
// et le MODE DÉGRADÉ (API non-officielle injoignable/instable) derrière le même port, pour que
// la feature reste démo-able quoi qu'il arrive. externalId stables → ingestion idempotente.
export class FixtureEsportsScheduleProvider implements EsportsScheduleProvider {
  constructor(private readonly now: () => number = () => Date.now()) {}

  async fetchUpcoming(): Promise<EsportsSchedule> {
    const base = this.now();
    const inDays = (days: number): string => new Date(base + days * 86_400_000).toISOString();
    const matches: ScheduledMatch[] = [
      {
        // Match « récemment terminé » : sert la PREUVE du règlement auto en démo
        // (cf. FixtureEsportsResultProvider → G2 gagne). Les vrais matchs à venir ne finissent
        // pas pendant la soutenance, d'où ce fixture déjà joué et réglable immédiatement.
        externalId: 'esports-fixture-lec-g2-fnc',
        game: 'LoL',
        league: 'LEC',
        teamA: 'G2 Esports',
        teamB: 'Fnatic',
        startTime: inDays(-1),
      },
      {
        externalId: 'esports-fixture-lck-t1-geng',
        game: 'LoL',
        league: 'LCK',
        teamA: 'T1',
        teamB: 'Gen.G',
        startTime: inDays(2),
      },
      {
        externalId: 'esports-fixture-lpl-blg-tes',
        game: 'LoL',
        league: 'LPL',
        teamA: 'Bilibili Gaming',
        teamB: 'Top Esports',
        startTime: inDays(3),
      },
    ];
    return { source: 'fixtures', matches };
  }
}
