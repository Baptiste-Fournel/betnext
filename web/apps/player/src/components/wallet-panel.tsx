'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  apiMessage,
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
} from '@betnext/ui';

function newKey(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `dep-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function WalletPanel({
  onDeposited,
  refreshKey,
}: {
  onDeposited?: () => void;
  // Incrémenté par le parent quand le solde a pu changer ailleurs (ex. pari placé) → recharge.
  refreshKey?: number;
}): React.JSX.Element {
  const [balance, setBalance] = useState<number | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [amount, setAmount] = useState('50');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCredited, setJustCredited] = useState<number | null>(null);
  // Clé d'idempotence STABLE par tentative (même montant) → un retry réseau ne re-charge jamais.
  const attempt = useRef<{ key: string; sig: string } | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    setBalance(undefined);
    try {
      const { data } = await api.GET('/wallet/balance');
      if (!data) {
        setLoadError(true);
        return;
      }
      setBalance(data.balance);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  function idempotencyKey(sig: string): string {
    if (attempt.current && attempt.current.sig === sig) {
      return attempt.current.key;
    }
    const key = newKey();
    attempt.current = { key, sig };
    return key;
  }

  async function deposit(): Promise<void> {
    const value = Number(amount);
    setSubmitting(true);
    setError(null);
    setJustCredited(null);
    try {
      const key = idempotencyKey(`${value}`);
      const { data, error: depError, response } = await api.POST('/wallet/deposit', {
        params: { header: { 'Idempotency-Key': key } },
        body: { amount: value },
      });
      if (depError || !data) {
        setError(apiMessage(depError, response?.status));
        return;
      }
      attempt.current = null;
      setJustCredited(data.amount);
      await load();
      onDeposited?.();
    } catch {
      setError('Impossible de joindre l’API.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mon portefeuille</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loadError ? (
          <Alert variant="error" role="alert" title="Impossible de charger le solde.">
            <Button variant="outline" size="sm" className="mt-1" onClick={() => void load()}>
              Réessayer
            </Button>
          </Alert>
        ) : balance === undefined ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <div className="rounded-md border bg-background p-3">
            <p className="text-xs text-muted-foreground">Solde courant</p>
            <p className="text-lg font-semibold tabular-nums">
              {balance === null ? 'Aucun wallet' : `${balance.toFixed(2)} €`}
            </p>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="deposit">Déposer des fonds (Stripe — test)</Label>
          <div className="flex gap-2">
            <Input
              id="deposit"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="ex. 50"
              aria-invalid={error !== null}
              aria-describedby={error ? 'deposit-error' : undefined}
            />
            <Button
              onClick={() => void deposit()}
              disabled={submitting || amount === '' || Number(amount) <= 0}
            >
              {submitting ? '…' : 'Déposer'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Charge sécurisée par saga : si une étape échoue, vous êtes remboursé (aucune perte).
          </p>
        </div>
        <div aria-live="polite">
          {justCredited !== null && (
            <Alert variant="success" title="Dépôt crédité">
              <span className="tabular-nums">+{justCredited.toFixed(2)} €</span> ajoutés à votre
              solde.
            </Alert>
          )}
          {error && (
            <Alert id="deposit-error" role="alert" variant="error" title="Dépôt refusé">
              {error}
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
