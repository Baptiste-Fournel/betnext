'use client';

import type { ReactNode } from 'react';
import { useAuth, type Role } from './auth/auth-context';
import { LoginScreen } from './auth/login-screen';
import { AppHeader } from './auth/app-header';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { cn } from '../lib/utils';

const ROLE_LABEL: Record<Role, string> = { PLAYER: 'joueur', MANAGER: 'gestionnaire' };
const ROLE_TAG: Record<Role, string> = { PLAYER: 'Joueur', MANAGER: 'Gestionnaire' };

const MAX_WIDTH = { default: 'max-w-2xl', wide: 'max-w-5xl' } as const;

export function AppShell({
  role,
  loginDefaultUsername,
  siblingAppLabel,
  siblingAppHref,
  maxWidth = 'default',
  children,
}: {
  role: Role;
  loginDefaultUsername?: string;
  siblingAppLabel?: string;
  siblingAppHref?: string;
  maxWidth?: keyof typeof MAX_WIDTH;
  children: ReactNode;
}): React.JSX.Element {
  const { status, user, logout } = useAuth();

  if (status === 'loading') {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 p-8">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (status === 'anonymous' || !user) {
    return <LoginScreen defaultUsername={loginDefaultUsername} />;
  }

  if (user.role !== role) {
    // Mauvais rôle : on envoie l'utilisateur vers le LOGIN de la bonne plateforme,
    // déconnecté. Les sessions ne traversent pas les origines (token en localStorage
    // par origine), donc on (1) purge la session résiduelle de CETTE origine et (2)
    // signale à l'app sœur de purger la sienne via ?signout=1, sinon elle réafficherait
    // son propre gate au lieu du login.
    const goToSiblingLogin = (): void => {
      logout();
      if (!siblingAppHref) return;
      try {
        const target = new URL(siblingAppHref);
        target.searchParams.set('signout', '1');
        window.location.href = target.toString();
      } catch {
        window.location.href = siblingAppHref;
      }
    };

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 p-4 sm:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mauvaise interface</CardTitle>
            <CardDescription>
              Ce compte a le rôle <strong>{ROLE_LABEL[user.role]}</strong> ; cette interface est
              réservée au rôle <strong>{ROLE_LABEL[role]}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {siblingAppHref && (
              <Button onClick={goToSiblingLogin}>
                Aller à l’interface {siblingAppLabel ?? ROLE_LABEL[user.role]}
              </Button>
            )}
            <Button variant="outline" onClick={logout}>
              Se déconnecter
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className={cn('mx-auto flex min-h-screen w-full flex-col gap-6 p-4 sm:p-8', MAX_WIDTH[maxWidth])}>
      <AppHeader tag={ROLE_TAG[role]} />
      {children}
    </main>
  );
}
