'use client';

import type { ReactNode } from 'react';
import { useAuth, type Role } from './auth/auth-context';
import { LoginScreen } from './auth/login-screen';
import { SessionBar } from './auth/session-bar';
import { Button, buttonVariants } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { cn } from '../lib/utils';

const ROLE_LABEL: Record<Role, string> = { PLAYER: 'joueur', MANAGER: 'gestionnaire' };

/**
 * Coquille AUTH + SCOPING PAR RÔLE, PARTAGÉE par les deux apps. Chaque app déclare le rôle qu'elle
 * sert (`role`) ; la coquille décide quoi rendre :
 *   chargement → squelette ; anonyme → login (compte de démo de l'app) ;
 *   authentifié mais MAUVAIS rôle → écran « mauvaise interface » (+ lien vers l'app du rôle) ;
 *   authentifié et BON rôle → barre de session + la vue de l'app.
 *
 * IMPORTANT (anti-contournement) : ce garde côté client ne fait que PILOTER L'UX. L'autorité reste
 * 100 % serveur — chaque appel API est scopé par le token (BET-20), donc un joueur qui forcerait
 * l'app admin n'obtiendrait que des 403/données vides du back. Le front ne décide JAMAIS des droits.
 */
export function AppShell({
  role,
  loginDefaultUsername,
  siblingAppLabel,
  siblingAppHref,
  children,
}: {
  role: Role;
  loginDefaultUsername?: string;
  siblingAppLabel?: string;
  siblingAppHref?: string;
  children: ReactNode;
}): React.JSX.Element {
  const { status, user, logout } = useAuth();

  if (status === 'loading') {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 p-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (status === 'anonymous' || !user) {
    return <LoginScreen defaultUsername={loginDefaultUsername} />;
  }

  if (user.role !== role) {
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
              <a href={siblingAppHref} className={cn(buttonVariants())}>
                Aller à l’interface {siblingAppLabel ?? ROLE_LABEL[user.role]}
              </a>
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
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 p-4 sm:p-8">
      <SessionBar />
      {children}
    </main>
  );
}
