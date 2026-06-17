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
  Select,
} from '@betnext/ui';

type Featured = components['schemas']['FeaturedMatchDto'];
type Side = 'HOME' | 'AWAY' | 'DRAW';

type State =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'created'; featured: Featured }
  | { kind: 'error'; message: string };

const SIDE_LABEL: Record<Side, string> = {
  HOME: 'Équipe 1 (HOME · team 100)',
  AWAY: 'Équipe 2 (AWAY · team 200)',
  DRAW: 'Match nul (DRAW)',
};

interface OutcomeRow {
  label: string;
  side: Side;
}

export function FeatureMatch({ onFeatured }: { onFeatured?: () => void }): React.JSX.Element {
  const [name, setName] = useState('');
  const [game, setGame] = useState('LoL');
  const [matchId, setMatchId] = useState('');
  const [region, setRegion] = useState('EUW');
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([
    { label: '', side: 'HOME' },
    { label: '', side: 'AWAY' },
  ]);
  const [state, setState] = useState<State>({ kind: 'idle' });

  const setOutcome = (i: number, patch: Partial<OutcomeRow>): void =>
    setOutcomes((arr) => arr.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const addDraw = (): void => setOutcomes((arr) => [...arr, { label: 'Match nul', side: 'DRAW' }]);
  const removeOutcome = (i: number): void =>
    setOutcomes((arr) => (arr.length > 2 ? arr.filter((_, idx) => idx !== i) : arr));
  const hasDraw = outcomes.some((o) => o.side === 'DRAW');

  async function submit(): Promise<void> {
    setState({ kind: 'saving' });
    try {
      const { data, error, response } = await api.POST('/game-integration/featured', {
        body: { name, game, matchId, region: region.trim() || undefined, outcomes },
      });
      if (error || !data) {
        setState({ kind: 'error', message: apiMessage(error, response?.status) });
        return;
      }
      setState({ kind: 'created', featured: data });
      setName('');
      setMatchId('');
      setOutcomes([
        { label: '', side: 'HOME' },
        { label: '', side: 'AWAY' },
      ]);
      onFeatured?.();
    } catch {
      setState({ kind: 'error', message: 'Impossible de joindre l’API.' });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Featurer un match Riot</CardTitle>
        <CardDescription>
          One-step : crée le marché et le lie à un match Riot réel. Réglage en direct via le bouton
          « Synchroniser » une fois la partie terminée.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="f-name">Événement</Label>
          <Input
            id="f-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. G2 vs Fnatic — LEC"
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="f-game">Jeu</Label>
            <Input
              id="f-game"
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="w-32"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-region">Région</Label>
            <Input
              id="f-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="EUW"
              className="w-28"
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="f-match">Match ID Riot</Label>
          <Input
            id="f-match"
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            placeholder="ex. EUW1_7437325115"
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Issues → côté Riot</legend>
          {outcomes.map((outcome, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                aria-label={`Libellé issue ${i + 1}`}
                value={outcome.label}
                onChange={(e) => setOutcome(i, { label: e.target.value })}
                placeholder={`Issue ${i + 1}`}
              />
              <Select
                aria-label={`Côté issue ${i + 1}`}
                value={outcome.side}
                onChange={(e) => setOutcome(i, { side: e.target.value as Side })}
                className="w-56"
              >
                {(['HOME', 'AWAY', 'DRAW'] as Side[]).map((s) => (
                  <option key={s} value={s}>
                    {SIDE_LABEL[s]}
                  </option>
                ))}
              </Select>
              {outcomes.length > 2 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeOutcome(i)}
                  aria-label={`Retirer l'issue ${i + 1}`}
                >
                  −
                </Button>
              )}
            </div>
          ))}
          {!hasDraw && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addDraw}
              className="self-start"
            >
              + Ajouter « Match nul »
            </Button>
          )}
        </fieldset>
        <Button onClick={() => void submit()} disabled={state.kind === 'saving'}>
          {state.kind === 'saving' ? 'Création…' : 'Featurer le match'}
        </Button>
        <div aria-live="polite">
          {state.kind === 'created' && (
            <Alert variant="success" role="status" title="Match featuré">
              Marché « {state.featured.marketId} » lié à {state.featured.matchId}
              {state.featured.region ? ` (${state.featured.region})` : ''}.
            </Alert>
          )}
          {state.kind === 'error' && (
            <Alert variant="error" role="alert" title="Impossible de featurer">
              {state.message}
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
