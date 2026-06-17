'use client';

import { useAuth } from '@/components/auth/auth-context';
import { LoginScreen } from '@/components/auth/login-screen';
import { SessionBar } from '@/components/auth/session-bar';
import { PlayerView } from '@/components/views/player-view';
import { ManagerView } from '@/components/views/manager-view';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Coquille AUTH-AWARE (BET-20). Selon l'état : chargement → squelette ; anonyme → écran de login ;
 * authentifié → barre de session + la vue de SON rôle (PLAYER ou MANAGER, depuis /auth/me). Le front
 * reste UNIQUE (la vraie séparation joueur/admin est un ticket dédié) ; ici il ne fait que masquer /
 * afficher — la sécurité est imposée côté serveur.
 */
export default function Home(): React.JSX.Element {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 p-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (status === 'anonymous' || !user) {
    return <LoginScreen />;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 p-4 sm:p-8">
      <SessionBar />
      {user.role === 'MANAGER' ? <ManagerView /> : <PlayerView />}
    </main>
  );
}
