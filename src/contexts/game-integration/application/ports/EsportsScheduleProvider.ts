export const ESPORTS_SCHEDULE_PROVIDER = Symbol('EsportsScheduleProvider');

export type ScheduleSource = 'live' | 'fixtures';

export interface ScheduledMatch {
  externalId: string;
  game: string;
  league: string;
  teamA: string;
  teamB: string;
  startTime: string;
}

export interface EsportsSchedule {
  source: ScheduleSource;
  matches: ScheduledMatch[];
}

export interface EsportsScheduleProvider {
  fetchUpcoming(): Promise<EsportsSchedule>;
}
