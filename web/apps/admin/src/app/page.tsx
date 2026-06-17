import { AppShell } from '@betnext/ui';
import { ManagerView } from '@/components/manager-view';

export default function Home(): React.JSX.Element {
  return (
    <AppShell
      role="MANAGER"
      loginDefaultUsername="demo-manager"
      siblingAppLabel="joueur"
      siblingAppHref={process.env.NEXT_PUBLIC_PLAYER_URL}
      maxWidth="wide"
    >
      <ManagerView />
    </AppShell>
  );
}
