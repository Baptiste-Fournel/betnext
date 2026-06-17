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

type IngestSummary = components['schemas']['IngestSummaryDto'];

type IngestState =
  | { kind: 'idle' }
  | { kind: 'ingesting' }
  | { kind: 'done'; summary: IngestSummary }
  | { kind: 'error'; message: string };

export function IngestEsports({ onIngested }: { onIngested?: () => void }): React.JSX.Element {
  const [state, setState] = useState<IngestState>({ kind: 'idle' });

  async function ingest(): Promise<void> {
    setState({ kind: 'ingesting' });
    try {
      const { data, error, response } = await api.POST('/game-integration/esports/ingest');
      if (error || !data) {
        setState({ kind: 'error', message: apiMessage(error, response?.status) });
        return;
      }
      setState({ kind: 'done', summary: data });
      onIngested?.();
    } catch {
      setState({ kind: 'error', message: 'Impossible de joindre l’API.' });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Matchs LoL pro à venir</CardTitle>
        <CardDescription>
          Ingérez les gros matchs à venir (LEC/LCK/LPL/MSI…) en marchés bettables. Idempotent : un
          re-pull ne duplique jamais les marchés. Source live, ou fixtures si l’API est injoignable.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button onClick={() => void ingest()} disabled={state.kind === 'ingesting'}>
          {state.kind === 'ingesting' ? 'Ingestion…' : 'Ingérer les matchs à venir'}
        </Button>
        <div aria-live="polite">
          {state.kind === 'done' && (
            <Alert
              variant={state.summary.ingested > 0 ? 'success' : 'info'}
              role="status"
              title={`Feed : ${state.summary.source === 'live' ? 'live (LoL Esports)' : 'fixtures (mode dégradé)'}`}
            >
              <span className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{state.summary.ingested} créés</Badge>
                <Badge variant="outline">{state.summary.skipped} déjà présents</Badge>
                <Badge variant="outline">{state.summary.total} reçus</Badge>
                {state.summary.failed > 0 && (
                  <Badge variant="destructive">{state.summary.failed} ignorés</Badge>
                )}
              </span>
            </Alert>
          )}
          {state.kind === 'error' && (
            <Alert variant="error" role="alert" title="Ingestion impossible">
              {state.message}
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
