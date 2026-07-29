import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import Shell from '@/components/Shell';

export const metadata: Metadata = {
  title: 'Painel Convênio · Alchemypet',
  description: 'Gestão de pendências de convênio da Alchemypet.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          <Shell>{children}</Shell>
        </AuthProvider>
      </body>
    </html>
  );
}
