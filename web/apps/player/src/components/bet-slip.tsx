'use client';

import { useRef, useState } from 'react';
import type { components } from '@betnext/api-contract';
import {
  api,
  apiMessage,
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  LockIcon,
  TicketIcon,
} from '@betnext/ui';

type Market = components['schemas']['MarketDto'];
type Outcome = components['schemas']['OutcomeDto'];
type BetResult = components['schemas']['PlaceBetResponse'];
export type Selection = { market: Market; outcome: Outcome };

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; bet: BetResult }
  | { kind: 'error'; message: string; capExceeded: boolean };

function newKey(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `bet-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function BetSlip({
  userId,
  selection,
  liveOdds,
  onPlaced,
  onClear,
}: {
  userId: string;
  selection: Selection | null;
  liveOdds: number | null;
  onPlaced?: () => void;
  onClear?: () => void;
}): React.JSX.Element {
  const [stake, setStake] = useState('20');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const attempt = useRef<{ key: string; sig: string } | null>(null);

  function idempotencyKey(sig: string): string {
    if (attempt.current && attempt.current.sig === sig) {
      return attempt.current.key;
    }
    const key = newKey();
    attempt.current = { key, sig };
    return key;
  }

  async function submit(): Promise<void> {
    if (!selection) return;
    const amount = Number(stake);
    const sig = `${userId}|${selection.outcome.id}|${amount}`;
    const key = idempotencyKey(sig);
    setState({ kind: 'submitting' });
    try {
      const { data, error, response } = await api.POST('/bets', {
        params: { header: { 'Idempotency-Key': key } },
        body: { outcomeId: selection.outcome.id, stake: amount },
      });
      if (error || !data) {
        const status = response?.status;
        setState({ kind: 'error', message: apiMessage(error, status), capExceeded: status === 403 });
        return;
      }
      attempt.current = null;
      setState({ kind: 'success', bet: data });
      onPlaced?.();
    } catch {
      setState({ kind: 'error', message: 'Impossible de joindre l’API.', capExceeded: false });
    }
  }

  const hasError = state.kind === 'error';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <TicketIcon className="h-4 w-4 text-primary" />
          Coupon
        </CardTitle>
        {selection && onClear && (
          <Button variant="outline" size="sm" onClick={onClear} aria-label="Vider le coupon">
            Vider
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!selection ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sélectionnez une issue pour composer votre pari.
          </p>
        ) : (
          <>
            <div className="rounded-md border bg-background p-3">
              <p className="text-xs text-muted-foreground">{selection.market.name}</p>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span className="font-medium">{selection.outcome.label}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {liveOdds == null ? (
                    <span className="text-warning">cote d&apos;ouverture</span>
                  ) : (
                    <>
                      cote live <span className="font-semibold text-foreground">{liveOdds.toFixed(2)}</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="stake">Mise</Label>
              <Input
                id="stake"
                type="number"
                min={1}
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                aria-invalid={hasError}
                aria-describedby={hasError ? 'bet-error' : undefined}
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => void submit()}
                disabled={state.kind === 'submitting'}
              >
                {state.kind === 'submitting' ? 'Envoi…' : 'Placer le pari'}
              </Button>
              {hasError && (
                <Button variant="outline" onClick={() => void submit()}>
                  Réessayer
                </Button>
              )}
            </div>

            <div aria-live="polite">
              {state.kind === 'success' && (
                <Alert variant="success" title="Pari posé">
                  <div className="flex flex-col gap-1.5 text-foreground">
                    <span className="text-xs text-muted-foreground">
                      Réf. {state.bet.betId.slice(0, 8)}…
                      {state.bet.pricingProvisional && (
                        <Badge variant="warning" className="ml-2">
                          cote d&apos;ouverture
                        </Badge>
                      )}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <LockIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      Cote figée{' '}
                      <strong className="tabular-nums">{state.bet.lockedOdds.toFixed(2)}</strong>
                      <span className="text-muted-foreground">
                        · marché{' '}
                        <span className="tabular-nums">
                          {liveOdds == null ? '—' : liveOdds.toFixed(2)}
                        </span>
                      </span>
                    </span>
                    <span>
                      Gain potentiel{' '}
                      <strong className="tabular-nums text-primary">
                        {state.bet.potentialGain.toFixed(2)}
                      </strong>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      La cote figée ne bouge plus, même si la cote live du marché évolue.
                    </span>
                  </div>
                </Alert>
              )}
            </div>

            {hasError && state.capExceeded && (
              <Alert id="bet-error" role="alert" variant="error" title="Plafond quotidien dépassé">
                {state.message} — réduisez la mise ou ajustez votre plafond ci-dessous.
              </Alert>
            )}
            {hasError && !state.capExceeded && (
              <Alert id="bet-error" role="alert" variant="error" title="Pari refusé">
                {state.message}
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
