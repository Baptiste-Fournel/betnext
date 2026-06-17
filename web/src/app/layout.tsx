import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AuthProvider } from '@/components/auth/auth-context';

export const metadata: Metadata = {
  title: 'BetNext',
  description: "Front BetNext (POC) — client typé contre l'OpenAPI du back, authentifié.",
};

export default function RootLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
