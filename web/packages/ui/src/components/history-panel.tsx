'use client';

import { useCallback, useEffect, useState } from 'react';
import type { components } from '@betnext/api-contract';
import { api } from '../lib/api/client';
import { Alert } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { BetStatusBadge } from './bet-status-badge';

type Bet = components['schemas']['BetViewDto'];
type BetEvent = components['schemas']['BetEventDto'];

const EVENT_LABEL: Record<string, string> = {
  BetPlaced: 'Posé',
  BetWon: 'Gagné',
  BetLost: 'Perdu',
  BetVoided: 'Annulé',
};

type OutcomeLabel = { label: string; market: string };

export function HistoryPanel({ refreshKey }: { refreshKey: number }): React.JSX.Element {
  const [bets, setBets] = useState<Bet[] | null>(null);
  const [error, setError] = useState(false);
  const [timelines, setTimelines] = useState<Record<string, BetEvent[]>>({});
  const [labels, setLabels] = useState<Record<string, OutcomeLabel>>({});

  const load = useCallback(async () => {
    setError(false);
    setBets(null);
    try {
      const [{ data }, { data: markets }] = await Promise.all([
        api.GET('/bets'),
        api.GET('/markets'),
      ]);
      if (!data) {
        setError(true);
        return;
      }
      setBets(data);
      const resolved: Record<string, OutcomeLabel> = {};
      for (const market of markets ?? []) {
        for (const outcome of market.outcomes) {
          resolved[outcome.id] = { label: outcome.label, market: market.name };
        }
      }
      setLabels(resolved);
      const entries = await Promise.all(
        data.map(async (bet) => {
          const { data: events } = await api.GET('/bets/{id}/events', {
            params: { path: { id: bet.betId } },
          });
          return [bet.betId, events ?? []] as const;
        }),
      );
      setTimelines(Object.fromEntries(entries));
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historique des paris</CardTitle>
        <CardDescription>
          Chronologie reconstruite depuis le journal d&apos;événements du serveur.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && (
          <Alert variant="error" role="alert" title="Impossible de charger l'historique.">
            <Button variant="outline" size="sm" className="mt-1" onClick={() => void load()}>
              Réessayer
            </Button>
          </Alert>
        )}
        {!error && bets === null && (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        )}
        {!error && bets?.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aucun pari pour l&apos;instant.
          </p>
        )}
        {!error &&
          bets?.map((bet) => {
            const resolved = labels[bet.outcomeId];
            return (
              <div key={bet.betId} className="rounded-md border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{resolved?.label ?? bet.outcomeId}</span>
                    {resolved?.market && (
                      <span className="text-xs text-muted-foreground">{resolved.market}</span>
                    )}
                  </div>
                  <BetStatusBadge status={bet.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                  <span>
                    Mise <strong className="text-foreground">{bet.stake.toFixed(2)}</strong>
                  </span>
                  <span>
                    Cote figée <strong className="text-foreground">{bet.lockedOdds.toFixed(2)}</strong>
                  </span>
                  <span>
                    Gain potentiel{' '}
                    <strong className="text-foreground">{bet.potentialGain.toFixed(2)}</strong>
                  </span>
                </div>
                <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                  {(timelines[bet.betId] ?? []).map((event, index) => (
                    <li key={event.seq} className="flex items-center gap-1.5">
                      {index > 0 && <span aria-hidden>→</span>}
                      <span>{EVENT_LABEL[event.type] ?? event.type}</span>
                      <time dateTime={event.occurredAt} className="opacity-70">
                        {new Date(event.occurredAt).toLocaleTimeString()}
                      </time>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
