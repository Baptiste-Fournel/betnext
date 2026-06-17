export const ESPORTS_SCHEDULE_PROVIDER = Symbol('EsportsScheduleProvider');

export type ScheduleSource = 'live' | 'fixtures';

// Type DOMAINE d'un match pro à venir : c'est la frontière de l'ACL. Le format de la source
// externe (LoL Esports) ne franchit JAMAIS ce port — seuls ces champs neutres circulent.
export interface ScheduledMatch {
  externalId: string;
  game: string;
  league: string;
  teamA: string;
  teamB: string;
  startTime: string;
}

export interface EsportsSchedule {
  // `source` signale d'où viennent les matchs : 'live' (API jointe) ou 'fixtures' (mode dégradé).
  source: ScheduleSource;
  matches: ScheduledMatch[];
}

export interface EsportsScheduleProvider {
  fetchUpcoming(): Promise<EsportsSchedule>;
}
