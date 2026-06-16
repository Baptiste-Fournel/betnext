'use client';

import { useState } from 'react';
import type { components } from '@/lib/api/schema';
import { api } from '@/lib/api/client';
import { apiMessage } from '@/lib/api/error-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Market = components['schemas']['MarketDto'];

type State =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'created'; market: Market }
  | { kind: 'error'; message: string };

/**
 * Création d'un marché GÉNÉRIQUE (N issues — pas figé). CLIENT MINCE : envoie le payload, le back
 * valide (≥ 2 issues) et assigne les identifiants. Le front ne réimplémente aucune règle métier.
 */
export function CreateMarket({ onCreated }: { onCreated?: () => void }): React.JSX.Element {
  const [name, setName] = useState('');
  const [game, setGame] = useState('');
  const [issues, setIssues] = useState<string[]>(['', '']); // au moins 2
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
        <CardTitle className="text-base">Créer un marché (N issues)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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
            className="w-40"
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Issues (au moins 2)</legend>
          {issues.map((issue, i) => (
            <div key={i} className="flex items-center gap-2">
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
          <Button type="button" variant="secondary" size="sm" onClick={addIssue} className="self-start">
            + Ajouter une issue
          </Button>
        </fieldset>
        <Button onClick={() => void submit()} disabled={state.kind === 'saving'}>
          {state.kind === 'saving' ? 'Création…' : 'Créer le marché'}
        </Button>
        <div aria-live="polite">
          {state.kind === 'created' && (
            <p role="status" className="text-sm">
              Marché « {state.market.name} » créé ({state.market.outcomes.length} issues).
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
