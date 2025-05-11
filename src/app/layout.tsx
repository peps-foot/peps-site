// src/app/layout.tsx
import './globals.css';

export const metadata = {
  title: 'PEPS – Pronos entre Potes',
  description: 'Site de pronostics football entre amis',
  lang: 'fr'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head />
      <body className="font-sans antialiased bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
