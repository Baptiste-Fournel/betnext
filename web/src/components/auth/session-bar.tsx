'use client';

import { useAuth } from './auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/** Barre de session : identité + rôle (depuis /auth/me) + déconnexion (purge le token → login). */
export function SessionBar(): React.JSX.Element | null {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm">
      <span className="flex items-center gap-2">
        <span className="text-muted-foreground">Connecté :</span>
        <strong>{user.userId}</strong>
        <Badge variant={user.role === 'MANAGER' ? 'default' : 'secondary'}>{user.role}</Badge>
      </span>
      <Button variant="outline" size="sm" onClick={logout}>
        Se déconnecter
      </Button>
    </div>
  );
}
