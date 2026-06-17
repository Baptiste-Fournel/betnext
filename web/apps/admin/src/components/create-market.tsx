'use client';

import { useState } from 'react';
import type { components } from '@betnext/api-contract';
import {
  api,
  apiMessage,
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@betnext/ui';

type Market = components['schemas']['MarketDto'];

type State =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'created'; market: Market }
  | { kind: 'error'; message: string };

export function CreateMarket({ onCreated }: { onCreated?: () => void }): React.JSX.Element {
  const [name, setName] = useState('');
  const [game, setGame] = useState('');
  const [issues, setIssues] = useState<string[]>(['', '']);
  const [state, setState] = useState<State>({ kind: 'idle' });

  const setIssue = (i: number, value: string) =>
    setIssues((arr) => arr.map((v, idx) => (idx === i ? value : v)));
  const addIssue = () => setIssues((arr) => [...arr, '']);
  const removeIssue = (i: number) =>
    setIssues((arr) => (arr.length > 2 ? arr.filter((_, idx) => idx !== i) : arr));

  async function submit(): Promise<void> {
    setState({ kind: 'saving' });
    try {
      const { data, error, response } = await api.POST('/markets', {
        body: { name, game, outcomes: issues },
      });
      if (error || !data) {
        setState({ kind: 'error', message: apiMessage(error, response?.status) });
        return;
      }
      setState({ kind: 'created', market: data });
      setName('');
      setGame('');
      setIssues(['', '']);
      onCreated?.();
    } catch {
      setState({ kind: 'error', message: 'Impossible de joindre l’API.' });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ouvrir un marché</CardTitle>
        <CardDescription>Modèle générique à N issues (pas de binaire figé A/B).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="m-name">Événement</Label>
          <Input
            id="m-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. CS Major — NaVi vs Vitality"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="m-game">Jeu</Label>
          <Input
            id="m-game"
            value={game}
            onChange={(e) => setGame(e.target.value)}
            placeholder="ex. CS2"
            className="w-48"
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Issues (au moins 2)</legend>
          {issues.map((issue, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 text-center text-xs font-medium text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <Label htmlFor={`issue-${i}`} className="sr-only">
                Issue {i + 1}
              </Label>
              <Input
                id={`issue-${i}`}
                value={issue}
                onChange={(e) => setIssue(i, e.target.value)}
                placeholder={`Issue ${i + 1}`}
              />
              {issues.length > 2 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeIssue(i)}
                  aria-label={`Retirer l'issue ${i + 1}`}
                >
                  −
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addIssue}
            className="self-start"
          >
            + Ajouter une issue
          </Button>
        </fieldset>
        <Button onClick={() => void submit()} disabled={state.kind === 'saving'}>
          {state.kind === 'saving' ? 'Création…' : 'Créer le marché'}
        </Button>
        <div aria-live="polite">
          {state.kind === 'created' && (
            <Alert variant="success" role="status" title="Marché créé">
              « {state.market.name} » · {state.market.outcomes.length} issues.
            </Alert>
          )}
          {state.kind === 'error' && (
            <Alert variant="error" role="alert" title="Création impossible">
              {state.message}
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
