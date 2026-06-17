'use client';

import { useCallback, useEffect, useState } from 'react';
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

export function CapPanel(): React.JSX.Element {
  const [cap, setCap] = useState<number | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    setCap(undefined);
    try {
      const { data } = await api.GET('/responsible-gaming/daily-cap');
      if (!data) {
        setLoadError(true);
        return;
      }
      setCap(data.dailyCap);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(): Promise<void> {
    setSaving(true);
    setSaveError(null);
    try {
      const { error, response } = await api.PUT('/responsible-gaming/daily-cap', {
        body: { cap: Number(draft) },
      });
      if (error) {
        setSaveError(apiMessage(error, response?.status));
        return;
      }
      setDraft('');
      await load();
    } catch {
      setSaveError('Impossible de joindre l’API.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Jeu responsable</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loadError ? (
          <Alert variant="error" role="alert" title="Impossible de charger le plafond.">
            <Button variant="outline" size="sm" className="mt-1" onClick={() => void load()}>
              Réessayer
            </Button>
          </Alert>
        ) : cap === undefined ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <div className="rounded-md border bg-background p-3">
            <p className="text-xs text-muted-foreground">Plafond quotidien</p>
            <p className="text-lg font-semibold tabular-nums">
              {cap === null ? 'Aucun (illimité)' : cap.toFixed(2)}
            </p>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="cap">Définir un plafond</Label>
          <div className="flex gap-2">
            <Input
              id="cap"
              type="number"
              min={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="ex. 50"
              aria-invalid={saveError !== null}
              aria-describedby={saveError ? 'cap-error' : undefined}
            />
            <Button onClick={() => void save()} disabled={saving || draft === ''}>
              {saving ? '…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
        {saveError && (
          <Alert id="cap-error" role="alert" variant="error">
            {saveError}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
