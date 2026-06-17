import { AppShell } from '@betnext/ui';
import { PlayerView } from '@/components/player-view';

/**
 * Home de l'app JOUEUR. La coquille partagée gère l'auth + le scoping de rôle : seul un compte PLAYER
 * voit la vue joueur ; un MANAGER est renvoyé vers l'app admin. L'autorité reste serveur (BET-20).
 */
export default function Home(): React.JSX.Element {
  return (
    <AppShell
      role="PLAYER"
      loginDefaultUsername="demo-player"
      siblingAppLabel="gestionnaire"
      siblingAppHref={process.env.NEXT_PUBLIC_ADMIN_URL}
    >
      <PlayerView />
    </AppShell>
  );
}
