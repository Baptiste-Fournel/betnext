import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@betnext/ui/globals.css';
import { AuthProvider } from '@betnext/ui';

export const metadata: Metadata = {
  title: 'BetNext — Admin',
  description: "App gestionnaire BetNext (POC) — client typé contre l'OpenAPI du back, authentifié.",
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
