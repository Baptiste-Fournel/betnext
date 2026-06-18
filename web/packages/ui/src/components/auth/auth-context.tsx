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

const toRole = (value: string): Role => (value === 'MANAGER' ? 'MANAGER' : 'PLAYER');

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  const loadMe = useCallback(async () => {
    // Signal de déconnexion inter-apps : une app sœur nous redirige avec ?signout=1
    // pour garantir un atterrissage sur le LOGIN. Les tokens sont stockés par origine
    // (localStorage), donc cette origine peut détenir une session résiduelle d'un autre
    // rôle ; on la purge avant tout pour ne pas réafficher le gate au lieu du login.
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('signout')) {
        clearToken();
        params.delete('signout');
        const query = params.toString();
        window.history.replaceState(
          null,
          '',
          window.location.pathname + (query ? `?${query}` : '') + window.location.hash,
        );
        setUser(null);
        setStatus('anonymous');
        return;
      }
    }
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
