'use client';

import { useState } from 'react';
import { CreateMarket } from '@/components/create-market';
import { SettleMarket } from '@/components/settle-market';
import { HistoryPanel } from '@/components/history-panel';

/**
 * Vue GESTIONNAIRE (rendue pour un rôle MANAGER). Créer un marché (N issues) + régler (W/L/V). La
 * sécurité (rôle MANAGER) est imposée par le serveur ; cette vue n'est affichée que si le token le
 * permet. Après un règlement, l'historique se rafraîchit.
 */
export function ManagerView(): React.JSX.Element {
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = (): void => setRefreshKey((k) => k + 1);
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">BetNext — Gestionnaire</h1>
        <p className="text-sm text-muted-foreground">
          Créer un marché (N issues) et régler (gagné/perdu/annulé).
        </p>
      </header>
      <CreateMarket onCreated={bump} />
      <SettleMarket refreshKey={refreshKey} onSettled={bump} />
      <HistoryPanel refreshKey={refreshKey} />
    </section>
  );
}
