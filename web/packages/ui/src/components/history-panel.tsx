'use client';

import { useCallback, useEffect, useState } from 'react';
import type { components } from '@betnext/api-contract';
import { api } from '../lib/api/client';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Skeleton } from './ui/skeleton';

type Bet = components['schemas']['BetViewDto'];
type BetEvent = components['schemas']['BetEventDto'];

/** Libellés d'AFFICHAGE (le statut/les events viennent de l'API ; le front ne les calcule pas). */
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente',
  WON: 'Gagné',
  LOST: 'Perdu',
  VOID: 'Annulé',
  COMPENSATING: 'Compensation',
  REFUNDED: 'Remboursé',
};
const EVENT_LABEL: Record<string, string> = {
  BetPlaced: 'posé',
  BetWon: 'gagné',
  BetLost: 'perdu',
  BetVoided: 'annulé',
};

/** Seul LOST est "négatif" (rouge) ; WON positif ; le reste neutre (annulé/remboursé ≠ perdu). */
function statusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'WON') return 'default';
  if (status === 'LOST') return 'destructive';
  return 'secondary';
}

/**
 * Historique des paris (PARTAGÉ joueur/admin) : liste (GET /bets) + TIMELINE de chaque pari
 * (GET /bets/:id/events) lue depuis le journal d'événements du back → Event Sourcing VISIBLE (le
 * front affiche, ne reconstruit pas). États gérés : chargement (skeleton), erreur (+ réessayer), vide.
 * (GET /bets est scopé à l'utilisateur authentifié côté serveur — BET-20 ; le token est ajouté par le
 * middleware du client.)
 */
export function HistoryPanel({ refreshKey }: { refreshKey: number }): React.JSX.Element {
  const [bets, setBets] = useState<Bet[] | null>(null);
  const [error, setError] = useState(false);
  const [timelines, setTimelines] = useState<Record<string, BetEvent[]>>({});

  const load = useCallback(async () => {
    setError(false);
    setBets(null);
    try {
      const { data } = await api.GET('/bets');
      if (!data) {
        setError(true);
        return;
      }
      setBets(data);
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
          Timeline lue depuis le journal d&apos;événements du back (Event Sourcing).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-destructive" role="alert">
              Impossible de charger l&apos;historique.
            </span>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Réessayer
            </Button>
          </div>
        )}
        {!error && bets === null && (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        )}
        {!error && bets?.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun pari pour l&apos;instant.</p>
        )}
        {!error &&
          bets?.map((bet) => (
            <div key={bet.betId} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="tabular-nums">
                  {bet.outcomeId} · mise {bet.stake.toFixed(2)} · cote {bet.lockedOdds.toFixed(2)}
                </span>
                <Badge variant={statusVariant(bet.status)}>
                  {STATUS_LABEL[bet.status] ?? bet.status}
                </Badge>
              </div>
              <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
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
          ))}
      </CardContent>
    </Card>
  );
}
