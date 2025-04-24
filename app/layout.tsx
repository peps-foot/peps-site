// app/layout.tsx

export const metadata = {
  title: "PEPS - Pronos entre PoteS",
  description: "Jeu de pronostics football gratuits entre amis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}









