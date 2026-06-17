import { AppShell } from '@betnext/ui';
import { ManagerView } from '@/components/manager-view';

/**
 * Home de l'app ADMIN. La coquille partagée gère l'auth + le scoping de rôle : seul un compte MANAGER
 * voit la vue gestionnaire ; un PLAYER est renvoyé vers l'app joueur. L'autorité reste serveur (BET-20).
 */
export default function Home(): React.JSX.Element {
  return (
    <AppShell
      role="MANAGER"
      loginDefaultUsername="demo-manager"
      siblingAppLabel="joueur"
      siblingAppHref={process.env.NEXT_PUBLIC_PLAYER_URL}
    >
      <ManagerView />
    </AppShell>
  );
}
