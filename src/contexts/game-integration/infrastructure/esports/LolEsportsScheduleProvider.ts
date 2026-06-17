import {
  EsportsSchedule,
  EsportsScheduleProvider,
  ScheduledMatch,
} from '../../application/ports/EsportsScheduleProvider';

interface RawScheduleResponse {
  data?: { schedule?: { events?: RawEvent[] } };
}
interface RawEvent {
  startTime?: string;
  state?: string;
  league?: { name?: string };
  match?: { id?: string; teams?: Array<{ name?: string }> };
}

export interface LolEsportsOptions {
  hl?: string;
  limit?: number;
}

const PLACEHOLDER = 'TBD';

export class LolEsportsScheduleProvider implements EsportsScheduleProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly options: LolEsportsOptions = {},
  ) {}

  async fetchUpcoming(): Promise<EsportsSchedule> {
    const hl = this.options.hl ?? 'en-US';
    const res = await fetch(
      `${this.baseUrl}/persisted/gw/getSchedule?hl=${encodeURIComponent(hl)}`,
      { headers: { 'x-api-key': this.apiKey } },
    );
    if (!res.ok) {
      throw new Error(`Appel LoL Esports en échec (HTTP ${res.status})`);
    }
    const raw = (await res.json()) as RawScheduleResponse;
    const events = raw.data?.schedule?.events ?? [];
    const limit = this.options.limit ?? 8;

    const matches = events
      .map((event) => this.toScheduledMatch(event))
      .filter((match): match is ScheduledMatch => match !== null)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .slice(0, limit);

    return { source: 'live', matches };
  }

  private toScheduledMatch(event: RawEvent): ScheduledMatch | null {
    if (event.state !== 'unstarted') {
      return null;
    }
    const externalId = event.match?.id;
    const league = event.league?.name;
    const startTime = event.startTime;
    const teams = event.match?.teams ?? [];
    const teamA = teams[0]?.name;
    const teamB = teams[1]?.name;
    if (!externalId || !league || !startTime || !teamA || !teamB) {
      return null;
    }
    if (this.isPlaceholder(teamA) || this.isPlaceholder(teamB)) {
      return null;
    }
    return { externalId, game: 'LoL', league, teamA, teamB, startTime };
  }

  private isPlaceholder(name: string): boolean {
    return name.trim().toUpperCase() === PLACEHOLDER;
  }
}
