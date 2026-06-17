'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../lib/api/client';
import { apiMessage } from '../../lib/api/error-message';
import { clearToken, getToken, onTokenChange, setToken } from '../../lib/auth/token-store';

export type Role = 'PLAYER' | 'MANAGER';
interface AuthUser {
  userId: string;
  role: Role;
}
interface AuthState {
  status: 'loading' | 'anonymous' | 'authenticated';
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

/** Rôle serveur → rôle UI, validé (jamais un cast aveugle) : tout sauf MANAGER ⇒ PLAYER (least-privilege). */
const toRole = (value: string): Role => (value === 'MANAGER' ? 'MANAGER' : 'PLAYER');

/**
 * Source de vérité d'auth côté front, PARTAGÉE par les deux apps (joueur, admin). Au montage : si un
 * token existe, on récupère l'utilisateur via `GET /auth/me` (le rôle vient du serveur, jamais déduit
 * côté client). La SÉCURITÉ est imposée par le back ; ce contexte ne fait que piloter l'UX (login /
 * rôle / logout). Le scoping par app (quel rôle a le droit d'utiliser quelle app) est appliqué par
 * `<AppShell>`, mais l'autorité reste 100 % serveur. 401 → purge → retour login.
 */
export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setStatus('anonymous');
      return;
    }
    try {
      const { data } = await api.GET('/auth/me');
      if (data) {
        setUser({ userId: data.userId, role: toRole(data.role) });
        setStatus('authenticated');
      } else {
        clearToken();
        setUser(null);
        setStatus('anonymous');
      }
    } catch {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  // 401 (token purgé par le middleware) → revenir à l'état anonyme (écran de login).
  useEffect(
    () =>
      onTokenChange(() => {
        if (!getToken()) {
          setUser(null);
          setStatus('anonymous');
        }
      }),
    [],
  );

  const login = useCallback(async (username: string, password: string) => {
    try {
      const { data, error, response } = await api.POST('/auth/login', {
        body: { username, password },
      });
      if (error || !data) {
        return { ok: false, message: apiMessage(error, response?.status) };
      }
      setToken(data.token);
      setUser({ userId: data.userId, role: toRole(data.role) });
      setStatus('authenticated');
      return { ok: true };
    } catch {
      return { ok: false, message: 'Impossible de joindre l’API.' };
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus('anonymous');
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  }
  return ctx;
}
