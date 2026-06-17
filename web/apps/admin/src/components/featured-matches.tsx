'use client';

import { useCallback, useEffect, useState } from 'react';
import type { components } from '@betnext/api-contract';
import {
  api,
  apiMessage,
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@betnext/ui';

type Featured = components['schemas']['FeaturedMatchDto'];
type SyncResult = components['schemas']['SyncResultDto'];

type SyncState =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'done'; result: SyncResult }
  | { kind: 'error'; message: string };

export function FeaturedMatches({
  refreshKey,
  onSynced,
}: {
  refreshKey: number;
  onSynced?: () => void;
}): React.JSX.Element {
  const [matches, setMatches] = useState<Featured[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [sync, setSync] = useState<Record<string, SyncState>>({});

  const load = useCallback(async () => {
    setLoadError(false);
    setMatches(null);
    try {
      const { data } = await api.GET('/game-integration/featured');
      if (!data) {
        setLoadError(true);
        return;
      }
      setMatches(data);
    } catch {
      setLoadError(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function syncMatch(matchId: string): Promise<void> {
    setSync((s) => ({ ...s, [matchId]: { kind: 'syncing' } }));
    try {
      const { data, error, response } = await api.POST(
        '/game-integration/matches/{matchId}/sync',
        { params: { path: { matchId } } },
      );
      if (error || !data) {
        setSync((s) => ({
          ...s,
          [matchId]: { kind: 'error', message: apiMessage(error, response?.status) },
        }));
        return;
      }
      setSync((s) => ({ ...s, [matchId]: { kind: 'done', result: data } }));
      onSynced?.();
    } catch {
      setSync((s) => ({
        ...s,
        [matchId]: { kind: 'error', message: 'Impossible de joindre l’API.' },
      }));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Matchs Riot featurés</CardTitle>
        <CardDescription>
          Synchronisez le résultat une fois la partie terminée — règlement exactement une fois
          (rejouable sans double-crédit).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loadError && (
          <Alert variant="error" role="alert" title="Impossible de charger les matchs featurés.">
            <Button variant="outline" size="sm" className="mt-1" onClick={() => void load()}>
              Réessayer
            </Button>
          </Alert>
        )}
        {!loadError && matches === null && <Skeleton className="h-16 w-full" />}
        {!loadError && matches?.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aucun match featuré pour l&apos;instant.
          </p>
        )}
        {!loadError &&
          matches?.map((match) => {
            const s = sync[match.matchId] ?? { kind: 'idle' };
            return (
              <div
                key={match.matchId}
                className="flex flex-col gap-2 rounded-md border border-border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Featured · Riot</Badge>
                    <span className="font-mono text-sm">{match.matchId}</span>
                    {match.region && <Badge variant="outline">{match.region}</Badge>}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void syncMatch(match.matchId)}
                    disabled={s.kind === 'syncing'}
                  >
                    {s.kind === 'syncing' ? 'Synchronisation…' : 'Synchroniser / régler'}
                  </Button>
                </div>
                <div aria-live="polite">
                  {s.kind === 'done' && s.result.status === 'SETTLED' && (
                    <Alert
                      variant="success"
                      role="status"
                      title={`Réglé (${s.result.resolution ?? ''})`}
                    >
                      {s.result.summary
                        ? `${s.result.summary.settled} pari(s) · ${s.result.summary.won} gagnés · ${s.result.summary.lost} perdus · ${s.result.summary.voided} annulés`
                        : 'Marché réglé.'}
                    </Alert>
                  )}
                  {s.kind === 'done' && s.result.status === 'PENDING' && (
                    <Alert variant="info" role="status" title="Match non terminé">
                      Riot n&apos;a pas encore de résultat — réessayez plus tard.
                    </Alert>
                  )}
                  {s.kind === 'error' && (
                    <Alert variant="error" role="alert" title="Synchronisation impossible">
                      {s.message}
                    </Alert>
                  )}
                </div>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
