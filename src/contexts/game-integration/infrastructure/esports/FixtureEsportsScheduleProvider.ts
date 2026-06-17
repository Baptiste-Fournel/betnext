import {
  EsportsSchedule,
  EsportsScheduleProvider,
  ScheduledMatch,
} from '../../application/ports/EsportsScheduleProvider';

export class FixtureEsportsScheduleProvider implements EsportsScheduleProvider {
  constructor(private readonly now: () => number = () => Date.now()) {}

  async fetchUpcoming(): Promise<EsportsSchedule> {
    const base = this.now();
    const inDays = (days: number): string => new Date(base + days * 86_400_000).toISOString();
    const matches: ScheduledMatch[] = [
      {
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
