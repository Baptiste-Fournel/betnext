import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'BetNext',
  description: 'Front BetNext (POC) — client typé contre l\'OpenAPI du back.',
};

export default function RootLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
