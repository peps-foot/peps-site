export const metadata = {
  title: 'PEPS - Pronos entre PoteS',
  description: 'Site de pronostics de football entre amis',
};

export default function Layout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
