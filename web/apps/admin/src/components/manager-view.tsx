'use client';

import { useState } from 'react';
import { HistoryPanel } from '@betnext/ui';
import { CreateMarket } from '@/components/create-market';
import { SettleMarket } from '@/components/settle-market';
import { IngestEsports } from '@/components/ingest-esports';
import { SyncResults } from '@/components/sync-results';

export function ManagerView(): React.JSX.Element {
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = (): void => setRefreshKey((k) => k + 1);
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Console gestionnaire</h1>
        <p className="text-sm text-muted-foreground">
          Ouvrez un marché manuellement ou ingérez les matchs LoL pro à venir, puis synchronisez les
          résultats (règlement auto) — ou réglez un marché à la main.
        </p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <CreateMarket onCreated={bump} />
        <IngestEsports onIngested={bump} />
      </div>
      <SyncResults onSynced={bump} />
      <SettleMarket refreshKey={refreshKey} onSettled={bump} />
      <HistoryPanel refreshKey={refreshKey} />
    </section>
  );
}
