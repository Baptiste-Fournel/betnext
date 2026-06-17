'use client';

import { useCallback, useEffect, useState } from 'react';
import type { components } from '@betnext/api-contract';
import {
  api,
  API_BASE_URL,
  useAuth,
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  HistoryPanel,
  StatsPanel,
} from '@betnext/ui';
import { OutcomeOddsButton } from '@/components/outcome-odds-button';
import { BetSlip, type Selection } from '@/components/bet-slip';
import { CapPanel } from '@/components/cap-panel';
import { WalletPanel } from '@/components/wallet-panel';

type Market = components['schemas']['MarketDto'];
type UpcomingMatch = components['schemas']['UpcomingMatchDto'];
type OddsLiveEvent = components['schemas']['OddsLiveEventDto'];
type LiveState = 'connecting' | 'live' | 'reconnecting';
type OddsState = { value: number; opening: boolean };

function formatKickoff(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function parseOddsEvent(raw: string): OddsLiveEvent | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const value = parsed as Record<string, unknown>;
      if (typeof value.outcomeId === 'string' && typeof value.odds === 'number') {
        return { outcomeId: value.outcomeId, odds: value.odds };
      }
    }
  } catch {}
  return null;
}

const LIVE_LABEL: Record<LiveState, string> = {
  live: 'Cotes en direct',
  reconnecting: 'Reconnexion…',
  connecting: 'Connexion…',
};

export function PlayerView(): React.JSX.Element {
  const { user } = useAuth();
  const userId = user?.userId ?? '';
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [marketsError, setMarketsError] = useState(false);
  const [upcomingByMarket, setUpcomingByMarket] = useState<Map<string, UpcomingMatch>>(new Map());
  const [odds, setOdds] = useState<Record<string, OddsState | null>>({});
  const [live, setLive] = useState<LiveState>('connecting');
  const [selected, setSelected] = useState<Selection | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadMarkets = useCallback(async () => {
    setMarketsError(false);
    setMarkets(null);
    try {
      const { data } = await api.GET('/markets');
      if (!data) {
        setMarketsError(true);
        return;
      }
      setMarkets(data);
      try {
        const { data: upcoming } = await api.GET('/game-integration/upcoming');
        if (upcoming) setUpcomingByMarket(new Map(upcoming.map((u) => [u.marketId, u])));
      } catch {}
      const entries = await Promise.all(
        data
          .flatMap((m) => m.outcomes)
          .map(async (o) => {
            try {
              const { data: current } = await api.GET('/odds/{outcomeId}', {
                params: { path: { outcomeId: o.id } },
              });
              return [
                o.id,
                current ? { value: current.odds, opening: current.opening } : null,
              ] as const;
            } catch {
              return [o.id, null] as const;
            }
          }),
      );
      setOdds((prev) => ({ ...Object.fromEntries(entries), ...prev }));
    } catch {
      setMarketsError(true);
    }
  }, []);

  useEffect(() => {
    void loadMarkets();
  }, [loadMarkets]);

  useEffect(() => {
    const source = new EventSource(`${API_BASE_URL}/streams/odds`);
    source.onopen = () => setLive('live');
    source.onerror = () => {
      if (source.readyState !== EventSource.CLOSED) setLive('reconnecting');
    };
    source.onmessage = (event) => {
      const update = parseOddsEvent(event.data);
      if (update)
        setOdds((prev) => ({
          ...prev,
          [update.outcomeId]: { value: update.odds, opening: false },
        }));
    };
    return () => source.close();
  }, []);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Marchés à venir</h1>
          <p className="text-sm text-muted-foreground">
            Choisissez une issue, composez votre coupon, pariez à la cote figée.
          </p>
        </div>
        <Badge variant={live === 'live' ? 'success' : 'secondary'} aria-live="polite">
          <span
            className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
              live === 'live' ? 'animate-pulse bg-success' : 'bg-muted-foreground'
            }`}
            aria-hidden
          />
          {LIVE_LABEL[live]}
        </Badge>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-label="Marchés" className="flex flex-col gap-4">
          {marketsError && (
            <Alert variant="error" role="alert" title="Impossible de charger les marchés.">
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => void loadMarkets()}
              >
                Réessayer
              </Button>
            </Alert>
          )}
          {!marketsError &&
            markets === null &&
            [0, 1].map((i) => (
              <Card key={i} aria-hidden>
                <CardHeader>
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/4" />
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Skeleton className="h-14 flex-1" />
                  <Skeleton className="h-14 flex-1" />
                  <Skeleton className="h-14 flex-1" />
                </CardContent>
              </Card>
            ))}
          {!marketsError && markets?.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Aucun marché ouvert pour l&apos;instant.
              </CardContent>
            </Card>
          )}
          {!marketsError &&
            markets?.map((market) => {
              const upcoming = upcomingByMarket.get(market.id);
              return (
                <Card key={market.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{market.name}</CardTitle>
                        <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline">{market.game}</Badge>
                          {upcoming?.league && <Badge variant="default">{upcoming.league}</Badge>}
                          {upcoming?.startTime && (
                            <span className="text-xs text-muted-foreground">
                              🗓 {formatKickoff(upcoming.startTime)}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <Badge variant="success">Ouvert</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {market.outcomes.map((outcome) => (
                        <OutcomeOddsButton
                          key={outcome.id}
                          outcome={outcome}
                          odds={odds[outcome.id]?.value}
                          opening={odds[outcome.id]?.opening ?? false}
                          selected={selected?.outcome.id === outcome.id}
                          onSelect={() => setSelected({ market, outcome })}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </section>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          <BetSlip
            key={selected?.outcome.id ?? 'empty'}
            userId={userId}
            selection={selected}
            liveOdds={selected ? (odds[selected.outcome.id]?.value ?? null) : null}
            onPlaced={() => setRefreshKey((k) => k + 1)}
            onClear={() => setSelected(null)}
          />
          <WalletPanel refreshKey={refreshKey} onDeposited={() => setRefreshKey((k) => k + 1)} />
          <CapPanel />
        </aside>
      </div>

      <StatsPanel refreshKey={refreshKey} />

      <HistoryPanel refreshKey={refreshKey} />

      <footer className="text-xs text-muted-foreground">API : {API_BASE_URL}</footer>
    </section>
  );
}
