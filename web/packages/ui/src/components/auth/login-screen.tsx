'use client';

import { useState } from 'react';
import { useAuth } from './auth-context';
import { BrandMark } from '../brand';
import { Alert } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

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
      <div className="flex flex-col gap-3">
        <BrandMark />
        <p className="text-sm text-muted-foreground">
          La plateforme de paris e-sport. Connectez-vous pour accéder à votre interface.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connexion</CardTitle>
          <CardDescription>Utilisez un compte de démo pré-rempli ci-dessous.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
            <Alert id="login-error" role="alert" variant="error" title="Connexion refusée">
              {error}
            </Alert>
          )}
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="mb-1.5 font-medium text-foreground">Comptes de démo</p>
            <p>
              Joueur <code className="rounded bg-background px-1 py-0.5">demo-player</code> · Gestionnaire{' '}
              <code className="rounded bg-background px-1 py-0.5">demo-manager</code>
            </p>
            <p className="mt-1">
              Mot de passe <code className="rounded bg-background px-1 py-0.5">changeme123</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
