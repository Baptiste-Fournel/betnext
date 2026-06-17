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
  Label,
  Select,
  Skeleton,
  cn,
} from '@betnext/ui';

type Market = components['schemas']['MarketDto'];
type SettleResult = components['schemas']['SettleMarketResultDto'];

type State =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'done'; result: SettleResult }
  | { kind: 'error'; message: string };

const VOID_CHOICE = '__void__';

export function SettleMarket({
  refreshKey,
  onSettled,
}: {
  refreshKey: number;
  onSettled?: () => void;
}): React.JSX.Element {
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [marketId, setMarketId] = useState('');
  const [choice, setChoice] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  const load = useCallback(async () => {
    setLoadError(false);
    setMarkets(null);
    try {
      const { data } = await api.GET('/markets');
      if (!data) {
        setLoadError(true);
        return;
      }
      setMarkets(data);
    } catch {
      setLoadError(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const market = markets?.find((m) => m.id === marketId) ?? null;

  async function submit(): Promise<void> {
    if (!market) return;
    const voided = choice === VOID_CHOICE;
    setState({ kind: 'saving' });
    try {
      const { data, error, response } = await api.POST('/markets/settle', {
        body: {
          outcomes: market.outcomes.map((o) => o.id),
          winningOutcomeId: voided ? null : choice,
          voided,
        },
      });
      if (error || !data) {
        setState({ kind: 'error', message: apiMessage(error, response?.status) });
        return;
      }
      setState({ kind: 'done', result: data });
      onSettled?.();
    } catch {
      setState({ kind: 'error', message: 'Impossible de joindre l’API.' });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Régler un marché</CardTitle>
        <CardDescription>Désignez l&apos;issue gagnante ou annulez (remboursement).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loadError && (
          <Alert variant="error" role="alert" title="Impossible de charger les marchés.">
            <Button variant="outline" size="sm" className="mt-1" onClick={() => void load()}>
              Réessayer
            </Button>
          </Alert>
        )}
        {!loadError && markets === null && <Skeleton className="h-10 w-full" />}
        {!loadError && markets?.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">Aucun marché à régler.</p>
        )}

        {!loadError && markets && markets.length > 0 && (
          <div className="grid gap-1.5">
            <Label htmlFor="settle-market">Marché</Label>
            <Select
              id="settle-market"
              value={marketId}
              onChange={(e) => {
                setMarketId(e.target.value);
                setChoice('');
                setState({ kind: 'idle' });
              }}
            >
              <option value="">— choisir —</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {market && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Résultat</legend>
            {market.outcomes.map((o) => (
              <label
                key={o.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm transition-colors',
                  choice === o.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent',
                )}
              >
                <input
                  type="radio"
                  name="settle-choice"
                  className="accent-primary"
                  value={o.id}
                  checked={choice === o.id}
                  onChange={() => setChoice(o.id)}
                />
                <span>{o.label}</span>
                <span className="text-muted-foreground">gagnant</span>
              </label>
            ))}
            <label
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm transition-colors',
                choice === VOID_CHOICE
                  ? 'border-warning bg-warning/10'
                  : 'border-border hover:bg-accent',
              )}
            >
              <input
                type="radio"
                name="settle-choice"
                className="accent-primary"
                value={VOID_CHOICE}
                checked={choice === VOID_CHOICE}
                onChange={() => setChoice(VOID_CHOICE)}
              />
              <span>Annuler le marché</span>
              <span className="text-muted-foreground">remboursement</span>
            </label>
          </fieldset>
        )}

        {market && (
          <Button onClick={() => void submit()} disabled={choice === '' || state.kind === 'saving'}>
            {state.kind === 'saving' ? 'Règlement…' : 'Régler'}
          </Button>
        )}

        <div aria-live="polite">
          {state.kind === 'done' && (
            <Alert variant="success" role="status" title={`${state.result.settled} pari(s) réglé(s)`}>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge variant="success">{state.result.won} gagnés</Badge>
                <Badge variant="destructive">{state.result.lost} perdus</Badge>
                <Badge variant="secondary">{state.result.voided} annulés</Badge>
                {state.result.failed > 0 && (
                  <Badge variant="warning">{state.result.failed} échecs</Badge>
                )}
              </div>
            </Alert>
          )}
          {state.kind === 'error' && (
            <Alert variant="error" role="alert" title="Règlement impossible">
              {state.message}
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
