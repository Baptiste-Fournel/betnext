'use client';

import { useRef, useState } from 'react';
import type { components } from '@/lib/api/schema';
import { api } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiMessage } from '@/lib/api/error-message';

type Outcome = components['schemas']['OutcomeDto'];
type BetResult = components['schemas']['PlaceBetResponse'];

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; bet: BetResult }
  | { kind: 'error'; message: string; capExceeded: boolean };

/** UUID avec repli hors contexte sécurisé (http/LAN, vieux navigateurs) — évite un crash silencieux. */
function newKey(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `bet-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

/**
 * Formulaire de pose. CLIENT MINCE : AFFICHE la cote figée + le gain renvoyés par l'API (aucun
 * recalcul / aucune validation métier réimplémentée). Idempotency-Key par tentative, réutilisée au
 * retry. CONTRASTE COTE-FIGÉE : `lockedOdds` (figée) à côté de `liveOdds` (qui bouge via SSE).
 * Le refus de plafond (403, BET-13) est mappé en feedback CLAIR (pas un message générique).
 */
export function PlaceBetForm({
  userId,
  outcome,
  marketName,
  liveOdds,
  onPlaced,
}: {
  userId: string;
  outcome: Outcome;
  marketName: string;
  liveOdds: number | null;
  onPlaced?: () => void;
}): React.JSX.Element {
  const [stake, setStake] = useState('20');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const attempt = useRef<{ key: string; sig: string } | null>(null);

  function idempotencyKey(sig: string): string {
    if (attempt.current && attempt.current.sig === sig) {
      return attempt.current.key; // retry (mêmes paramètres) → MÊME clé
    }
    const key = newKey();
    attempt.current = { key, sig };
    return key;
  }

  async function submit(): Promise<void> {
    const amount = Number(stake);
    const sig = `${userId}|${outcome.id}|${amount}`;
    const key = idempotencyKey(sig);
    setState({ kind: 'submitting' });
    try {
      const { data, error, response } = await api.POST('/bets', {
        params: { header: { 'Idempotency-Key': key } },
        body: { userId, outcomeId: outcome.id, stake: amount },
      });
      if (error || !data) {
        const status = response?.status;
        setState({ kind: 'error', message: apiMessage(error, status), capExceeded: status === 403 });
        return; // tentative conservée → "Réessayer" rejoue la MÊME clé
      }
      attempt.current = null; // succès → prochaine pose = nouvelle tentative
      setState({ kind: 'success', bet: data });
      onPlaced?.(); // rafraîchit l'historique (read-your-writes)
    } catch {
      setState({ kind: 'error', message: 'Impossible de joindre l’API.', capExceeded: false });
    }
  }

  const hasError = state.kind === 'error';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Poser un pari — {outcome.label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="stake">
            Mise sur « {marketName} »
            {liveOdds != null && (
              <span className="ml-2 font-normal text-muted-foreground">
                cote live <span className="tabular-nums">{liveOdds.toFixed(2)}</span>
              </span>
            )}
          </Label>
          <Input
            id="stake"
            type="number"
            min={1}
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            aria-invalid={hasError}
            aria-describedby={hasError ? 'bet-error' : undefined}
            className="w-40"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void submit()} disabled={state.kind === 'submitting'}>
            {state.kind === 'submitting' ? 'Envoi…' : 'Placer le pari'}
          </Button>
          {hasError && (
            <Button variant="outline" onClick={() => void submit()}>
              Réessayer (même clé)
            </Button>
          )}
        </div>

        <div aria-live="polite">
          {state.kind === 'success' && (
            <div className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">Pari posé</span>
                {state.bet.pricingProvisional ? (
                  <Badge variant="secondary">cote d&apos;ouverture</Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground">Réf. {state.bet.betId.slice(0, 8)}…</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  Cote <strong>figée</strong>{' '}
                  <strong className="tabular-nums">{state.bet.lockedOdds.toFixed(2)}</strong>
                </span>
                <span className="text-muted-foreground">
                  Marché (live){' '}
                  <span className="tabular-nums">{liveOdds == null ? '—' : liveOdds.toFixed(2)}</span>
                </span>
                <span>
                  Gain potentiel{' '}
                  <strong className="tabular-nums">{state.bet.potentialGain.toFixed(2)}</strong>
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                La cote figée ne bouge pas, même quand la cote live du marché évolue.
                {state.bet.pricingProvisional
                  ? ' (Figée à la cote d’ouverture : read-model froid à la pose.)'
                  : ''}
              </p>
            </div>
          )}
        </div>

        {state.kind === 'error' && state.capExceeded && (
          <div id="bet-error" role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">
            <p className="font-medium text-destructive">Plafond quotidien dépassé</p>
            <p className="text-muted-foreground">
              {state.message} — réduisez la mise ou ajustez votre plafond ci-dessous.
            </p>
          </div>
        )}
        {state.kind === 'error' && !state.capExceeded && (
          <p id="bet-error" role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

