'use client';

import { useCallback, useEffect, useState } from 'react';
import type { components } from '@/lib/api/schema';
import { api } from '@/lib/api/client';
import { apiMessage } from '@/lib/api/error-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

type Market = components['schemas']['MarketDto'];
type SettleResult = components['schemas']['SettleMarketResultDto'];

type State =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'done'; result: SettleResult }
  | { kind: 'error'; message: string };

const VOID_CHOICE = '__void__';

/**
 * Règlement d'un marché par le gestionnaire. CLIENT MINCE : envoie l'ACTION (issue gagnante ou
 * annulation) ; le back résout les paris (statuts, payout, events — BET-12). États : chargement
 * (skeleton), erreur de chargement (+ réessayer), vide, erreur de règlement (message API).
 */
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
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loadError && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-destructive" role="alert">
              Impossible de charger les marchés.
            </span>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Réessayer
            </Button>
          </div>
        )}
        {!loadError && markets === null && <Skeleton className="h-10 w-full" />}
        {!loadError && markets?.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun marché à régler.</p>
        )}

        {!loadError && markets && markets.length > 0 && (
          <div className="grid gap-1.5">
            <Label htmlFor="settle-market">Marché</Label>
            <select
              id="settle-market"
              value={marketId}
              onChange={(e) => {
                setMarketId(e.target.value);
                setChoice('');
                setState({ kind: 'idle' });
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">— choisir —</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {market && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-medium">Résultat</legend>
            {market.outcomes.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="settle-choice"
                  value={o.id}
                  checked={choice === o.id}
                  onChange={() => setChoice(o.id)}
                />
                {o.label} <span className="text-muted-foreground">gagnant</span>
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="settle-choice"
                value={VOID_CHOICE}
                checked={choice === VOID_CHOICE}
                onChange={() => setChoice(VOID_CHOICE)}
              />
              Annuler le marché (remboursement)
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
            <p role="status" className="text-sm">
              Réglé : {state.result.settled} pari(s) — gagnés {state.result.won}, perdus{' '}
              {state.result.lost}, annulés {state.result.voided}
              {state.result.failed > 0 ? `, échecs ${state.result.failed}` : ''}.
            </p>
          )}
          {state.kind === 'error' && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
