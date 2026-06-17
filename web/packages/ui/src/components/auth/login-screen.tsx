'use client';

import { useState } from 'react';
import { useAuth } from './auth-context';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

/**
 * Écran de login PARTAGÉ : username + mot de passe → `POST /auth/login` (via le contexte d'auth). Le
 * token est stocké et envoyé automatiquement par le middleware du client API. CLIENT MINCE : aucune
 * logique d'auth ici (le serveur authentifie ; on affiche juste le formulaire et l'erreur renvoyée).
 * `defaultUsername` permet à chaque app de pré-remplir SON compte de démo (joueur vs gestionnaire).
 */
export function LoginScreen({
  defaultUsername = 'demo-player',
}: {
  defaultUsername?: string;
}): React.JSX.Element {
  const { login } = useAuth();
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState('changeme123');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    const res = await login(username.trim(), password);
    if (!res.ok) {
      setError(res.message ?? 'Identifiants invalides');
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold">BetNext</h1>
        <p className="text-sm text-muted-foreground">Connectez-vous pour accéder à la plateforme.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connexion</CardTitle>
          <CardDescription>Comptes de démo seedés ci-dessous.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="username">Identifiant</Label>
              <Input
                id="username"
                value={username}
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error !== null}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>
            <Button type="submit" disabled={busy || !username.trim() || !password}>
              {busy ? 'Connexion…' : 'Se connecter'}
            </Button>
          </form>
          {error && (
            <p id="login-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Démo : <strong>demo-player</strong> / <strong>demo-manager</strong> — mot de passe{' '}
            <strong>changeme123</strong>.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
