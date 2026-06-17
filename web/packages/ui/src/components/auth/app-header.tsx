'use client';

import { useAuth, type Role } from './auth-context';
import { BrandMark } from '../brand';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

const ROLE_LABEL: Record<Role, string> = { PLAYER: 'Joueur', MANAGER: 'Gestionnaire' };

export function AppHeader({ tag }: { tag?: string }): React.JSX.Element | null {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-2 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BrandMark tag={tag} />
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden items-center gap-2 sm:flex">
            <span className="text-muted-foreground">Connecté</span>
            <strong className="max-w-[12rem] truncate">{user.userId}</strong>
            <Badge variant={user.role === 'MANAGER' ? 'default' : 'secondary'}>
              {ROLE_LABEL[user.role]}
            </Badge>
          </span>
          <Button variant="outline" size="sm" onClick={logout}>
            Se déconnecter
          </Button>
        </div>
      </div>
    </header>
  );
}
