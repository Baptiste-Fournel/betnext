'use client';

import { useState } from 'react';
import { CreateMarket } from '@/components/create-market';
import { SettleMarket } from '@/components/settle-market';
import { HistoryPanel } from '@/components/history-panel';

/**
 * Vue GESTIONNAIRE (distincte de la vue joueur). Sans Identity, le rôle n'est ni scopé ni
 * authentifié — le front ne simule PAS d'auth (dette tracée). Après un règlement, l'historique
 * (en bas) se rafraîchit → la boucle posé → gagné/perdu est visible sur CE seul écran.
 */
export default function ManagerPage(): React.JSX.Element {
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = (): void => setRefreshKey((k) => k + 1);
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6 sm:p-8">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">BetNext — Gestionnaire</h1>
          <p className="text-sm text-muted-foreground">
            Créer un marché (N issues) et régler (gagné/perdu/annulé). Vue non authentifiée (dette Identity).
          </p>
        </div>
        <a href="/" className="text-sm underline underline-offset-4">
          ← Vue joueur
        </a>
      </header>
      <CreateMarket onCreated={bump} />
      <SettleMarket refreshKey={refreshKey} onSettled={bump} />
      <HistoryPanel refreshKey={refreshKey} />
    </main>
  );
}
