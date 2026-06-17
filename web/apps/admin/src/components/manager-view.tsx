'use client';

import { useState } from 'react';
import { HistoryPanel } from '@betnext/ui';
import { CreateMarket } from '@/components/create-market';
import { SettleMarket } from '@/components/settle-market';
import { FeatureMatch } from '@/components/feature-match';
import { FeaturedMatches } from '@/components/featured-matches';

export function ManagerView(): React.JSX.Element {
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = (): void => setRefreshKey((k) => k + 1);
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Console gestionnaire</h1>
        <p className="text-sm text-muted-foreground">
          Ouvrez un marché (N issues) puis réglez-le (gagné / perdu / annulé), ou featurez un match
          Riot réel réglé en direct.
        </p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <CreateMarket onCreated={bump} />
        <SettleMarket refreshKey={refreshKey} onSettled={bump} />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <FeatureMatch onFeatured={bump} />
        <FeaturedMatches refreshKey={refreshKey} onSynced={bump} />
      </div>
      <HistoryPanel refreshKey={refreshKey} />
    </section>
  );
}
