import './globals.css';
import type { Metadata } from 'next';
import { Oswald, Poppins } from 'next/font/google';
import ClientLayout from '../components/ClientLayout';

console.log('[layout] rendu');

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-title',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'PEPS - Pronos entre Potes',
  description: 'Site de jeu de pronostics de football entre amis',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${oswald.variable} ${poppins.variable}`}>
      <head>
        {/* Manifest et icône pour PWA */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/peps-icon.png" type="image/png" />

        {/* Métadonnées PWA / mobile */}
        <meta name="theme-color" content="#FF6600" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/peps-icon.png" />
      </head>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

