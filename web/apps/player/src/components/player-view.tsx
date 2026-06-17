'use client';

import { useCallback, useEffect, useState } from 'react';
import type { components } from '@betnext/api-contract';
import {
  api,
  API_BASE_URL,
  useAuth,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  HistoryPanel,
} from '@betnext/ui';
import { PlaceBetForm } from '@/components/place-bet-form';
import { CapPanel } from '@/components/cap-panel';

type Market = components['schemas']['MarketDto'];
type Outcome = components['schemas']['OutcomeDto'];
type OddsLiveEvent = components['schemas']['OddsLiveEventDto'];
type LiveState = 'connecting' | 'live' | 'reconnecting';

function parseOddsEvent(raw: string): OddsLiveEvent | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const value = parsed as Record<string, unknown>;
      if (typeof value.outcomeId === 'string' && typeof value.odds === 'number') {
        return { outcomeId: value.outcomeId, odds: value.odds };
      }
    }
  } catch {
    // payload illisible → ignoré
  }
  return null;
}

/** Parcours JOUEUR (rendu pour un rôle PLAYER) : marchés + cotes live (SSE) + pose + plafond + historique. */
export function PlayerView(): React.JSX.Element {
  const { user } = useAuth();
  const userId = user?.userId ?? '';
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [marketsError, setMarketsError] = useState(false);
  const [odds, setOdds] = useState<Record<string, number | null>>({});
  const [live, setLive] = useState<LiveState>('connecting');
  const [selected, setSelected] = useState<{ market: Market; outcome: Outcome } | null>(null);
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
      const entries = await Promise.all(
        data
          .flatMap((m) => m.outcomes)
          .map(async (o) => {
            try {
              const { data: current } = await api.GET('/odds/{outcomeId}', {
                params: { path: { outcomeId: o.id } },
              });
              return [o.id, current ? current.odds : null] as const;
            } catch {
              return [o.id, null] as const; // cote indisponible -> n'invalide pas le marché
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
      if (update) setOdds((prev) => ({ ...prev, [update.outcomeId]: update.odds }));
    };
    return () => source.close();
  }, []);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">BetNext — Joueur</h1>
          <p className="text-sm text-muted-foreground">
            Pari, cotes en direct, historique &amp; plafond.
          </p>
        </div>
        <Badge variant={live === 'live' ? 'default' : 'secondary'} aria-live="polite">
          {live === 'live' ? 'cotes live' : live === 'reconnecting' ? 'reconnexion…' : 'connexion…'}
        </Badge>
      </header>

      <section aria-label="Marchés" className="flex flex-col gap-4">
        {marketsError && (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <span className="text-destructive">Impossible de charger les marchés.</span>
              <Button variant="outline" size="sm" onClick={() => void loadMarkets()}>
                Réessayer
              </Button>
            </CardContent>
          </Card>
        )}
        {!marketsError &&
          markets === null &&
          [0, 1].map((i) => (
            <Card key={i} aria-hidden>
              <CardHeader>
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/4" />
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        {!marketsError && markets?.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun marché ouvert pour l&apos;instant.</p>
        )}
        {!marketsError &&
          markets?.map((market) => (
            <Card key={market.id}>
              <CardHeader>
                <CardTitle className="text-base">{market.name}</CardTitle>
                <CardDescription>{market.game}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {market.outcomes.map((outcome) => {
                  const current = odds[outcome.id];
                  const isSelected = selected?.outcome.id === outcome.id;
                  return (
                    <div
                      key={outcome.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
                    >
                      <span className="text-sm">{outcome.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {current == null ? 'cote indisponible' : `cote ${current.toFixed(2)}`}
                        </span>
                        <Button
                          size="sm"
                          variant={isSelected ? 'default' : 'outline'}
                          aria-pressed={isSelected}
                          onClick={() => setSelected({ market, outcome })}
                        >
                          {isSelected ? 'Sélectionné' : 'Parier'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
      </section>

      {selected && (
        <PlaceBetForm
          key={selected.outcome.id}
          userId={userId}
          outcome={selected.outcome}
          marketName={selected.market.name}
          liveOdds={odds[selected.outcome.id] ?? null}
          onPlaced={() => setRefreshKey((k) => k + 1)}
        />
      )}

      <CapPanel />
      <HistoryPanel refreshKey={refreshKey} />

      <footer className="text-xs text-muted-foreground">API : {API_BASE_URL}</footer>
    </section>
  );
}
