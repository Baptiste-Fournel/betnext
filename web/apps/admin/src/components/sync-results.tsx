'use client';

import { useState } from 'react';
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
} from '@betnext/ui';

type SyncSummary = components['schemas']['SyncResultsSummaryDto'];

type SyncState =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'done'; summary: SyncSummary }
  | { kind: 'error'; message: string };

export function SyncResults({ onSynced }: { onSynced?: () => void }): React.JSX.Element {
  const [state, setState] = useState<SyncState>({ kind: 'idle' });

  async function sync(): Promise<void> {
    setState({ kind: 'syncing' });
    try {
      const { data, error, response } = await api.POST('/game-integration/esports/sync-results');
      if (error || !data) {
        setState({ kind: 'error', message: apiMessage(error, response?.status) });
        return;
      }
      setState({ kind: 'done', summary: data });
      onSynced?.();
    } catch {
      setState({ kind: 'error', message: 'Impossible de joindre l’API.' });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Résultats des matchs du feed</CardTitle>
        <CardDescription>
          Récupère le résultat des matchs ingérés terminés et règle marchés + paris automatiquement
          (gagné / perdu / annulé). Exactly-once : un rejeu ne re-crédite jamais.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button onClick={() => void sync()} disabled={state.kind === 'syncing'}>
          {state.kind === 'syncing' ? 'Synchronisation…' : 'Synchroniser les résultats'}
        </Button>
        <div aria-live="polite">
          {state.kind === 'done' && state.summary.throttled && (
            <Alert variant="info" role="status" title="Patientez quelques secondes">
              Synchronisation trop fréquente — réessayez dans un instant (rate-limit).
            </Alert>
          )}
          {state.kind === 'done' && !state.summary.throttled && (
            <Alert
              variant={state.summary.settledBets > 0 ? 'success' : 'info'}
              role="status"
              title={
                state.summary.settledBets > 0
                  ? `${state.summary.settledBets} pari(s) réglé(s)`
                  : 'Aucun nouveau règlement'
              }
            >
              <span className="flex flex-wrap gap-1.5">
                <Badge variant="success">{state.summary.won} gagnés</Badge>
                <Badge variant="outline">{state.summary.lost} perdus</Badge>
                <Badge variant="outline">{state.summary.voided} annulés</Badge>
                <Badge variant="secondary">{state.summary.finished} match(s) terminé(s)</Badge>
                <Badge variant="outline">{state.summary.pending} à venir</Badge>
                {state.summary.failed > 0 && (
                  <Badge variant="destructive">{state.summary.failed} échecs (réessayables)</Badge>
                )}
              </span>
            </Alert>
          )}
          {state.kind === 'error' && (
            <Alert variant="error" role="alert" title="Synchronisation impossible">
              {state.message}
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
