'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { apiMessage } from '@/lib/api/error-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Panneau jeu responsable : LIT (GET) et DÉFINIT (PUT) le plafond quotidien du JOUEUR CONNECTÉ. Le
 * `userId` n'est plus envoyé (BET-20) : le back l'extrait du token → un joueur n'agit que sur SON
 * plafond. Client mince : aucune règle métier (validation « > 0 » et application côté back).
 */
export function CapPanel(): React.JSX.Element {
  const [cap, setCap] = useState<number | null | undefined>(undefined); // undefined = chargement
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
        <CardTitle className="text-base">Plafond quotidien (jeu responsable)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loadError ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-destructive" role="alert">
              Impossible de charger le plafond.
            </span>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Réessayer
            </Button>
          </div>
        ) : cap === undefined ? (
          <Skeleton className="h-5 w-40" />
        ) : (
          <p className="text-sm">
            Plafond actuel :{' '}
            <strong className="tabular-nums">
              {cap === null ? 'aucun (illimité)' : cap.toFixed(2)}
            </strong>
          </p>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="cap">Définir un plafond</Label>
            <Input
              id="cap"
              type="number"
              min={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="ex. 50"
              className="w-40"
              aria-invalid={saveError !== null}
              aria-describedby={saveError ? 'cap-error' : undefined}
            />
          </div>
          <Button onClick={() => void save()} disabled={saving || draft === ''}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
        {saveError && (
          <p id="cap-error" role="alert" className="text-sm text-destructive">
            {saveError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
