'use client';

import { useCallback, useEffect, useState } from 'react';
import type { components } from '@betnext/api-contract';
import { api } from '../lib/api/client';
import { Alert } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Skeleton } from './ui/skeleton';

type PlayerStats = components['schemas']['PlayerStatsDto'];

function StatTile({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function StatsPanel({ refreshKey }: { refreshKey: number }): React.JSX.Element {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setStats(null);
    try {
      const { data } = await api.GET('/bets/stats');
      if (!data) {
        setError(true);
        return;
      }
      setStats(data);
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
        <CardTitle className="text-base">Mes statistiques</CardTitle>
        <CardDescription>
          Agrégats calculés côté serveur, à partir de vos seuls paris.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && (
          <Alert variant="error" role="alert" title="Impossible de charger les statistiques.">
            <Button variant="outline" size="sm" className="mt-1" onClick={() => void load()}>
              Réessayer
            </Button>
          </Alert>
        )}
        {!error && stats === null && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {!error && stats !== null && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Paris" value={String(stats.totalBets)} />
              <StatTile label="Gagnés" value={String(stats.won)} />
              <StatTile label="Perdus" value={String(stats.lost)} />
              <StatTile label="En attente" value={String(stats.pending)} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label="Total misé" value={stats.totalStaked.toFixed(2)} />
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs text-muted-foreground">Gains/pertes nets</p>
                <p
                  className={`text-lg font-semibold tabular-nums ${
                    stats.netResult > 0
                      ? 'text-success'
                      : stats.netResult < 0
                        ? 'text-destructive'
                        : ''
                  }`}
                >
                  {stats.netResult > 0 ? '+' : ''}
                  {stats.netResult.toFixed(2)}
                </p>
              </div>
              <StatTile label="Taux de réussite" value={`${(stats.winRate * 100).toFixed(0)} %`} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
