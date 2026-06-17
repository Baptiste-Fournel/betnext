/**
 * Barrel public du package UI partagé. Les deux apps importent UNIQUEMENT depuis `@betnext/ui`
 * (jamais le chemin interne d'un fichier) — frontière propre, zéro copier-coller.
 */

// Primitives shadcn/ui
export { Button, buttonVariants, type ButtonProps } from './components/ui/button';
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from './components/ui/card';
export { Input } from './components/ui/input';
export { Label } from './components/ui/label';
export { Badge, badgeVariants, type BadgeProps } from './components/ui/badge';
export { Skeleton } from './components/ui/skeleton';

// Auth + coquille de rôle (scoping par app)
export { AuthProvider, useAuth, type Role } from './components/auth/auth-context';
export { LoginScreen } from './components/auth/login-screen';
export { SessionBar } from './components/auth/session-bar';
export { AppShell } from './components/app-shell';

// Composant métier partagé (joueur + admin)
export { HistoryPanel } from './components/history-panel';

// Client API typé + utilitaires (client MINCE, généré contre le contrat)
export { api } from './lib/api/client';
export { apiMessage } from './lib/api/error-message';
export { API_BASE_URL } from './lib/env';
export { cn } from './lib/utils';
