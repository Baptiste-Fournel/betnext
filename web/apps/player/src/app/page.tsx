import { AppShell } from '@betnext/ui';
import { PlayerView } from '@/components/player-view';

export default function Home(): React.JSX.Element {
  return (
    <AppShell
      role="PLAYER"
      loginDefaultUsername="demo-player"
      siblingAppLabel="gestionnaire"
      siblingAppHref={process.env.NEXT_PUBLIC_ADMIN_URL}
      maxWidth="wide"
    >
      <PlayerView />
    </AppShell>
  );
}
