'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * L'app est désormais RÔLE-AWARE : la home (`/`) affiche la vue du rôle (PLAYER/MANAGER) après login.
 * L'ancienne route `/manager` redirige donc vers `/`. (La vraie séparation des fronts est son ticket.)
 */
export default function ManagerRedirect(): null {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
