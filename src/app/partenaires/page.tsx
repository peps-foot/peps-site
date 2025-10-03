'use client';
import RuleSection from '../../components/RuleSection';

export default function PartenairesPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">

      <RuleSection
        title="LA F1NTE"
        iconSrc="/images/partenaires/laf1nte.png"
        type="default"
      >
        <div className="space-y-3">
          <p>⚽ Ton nouveau terrain pour des maillots de foot stylés et uniques.</p>
          <p>🔥 Des éditions rares, des prix imbattables, la passion du ballon rond au meilleur niveau.</p>
          <p>🚀 Fais la différence sur et en dehors du terrain avec LA F1NTE !</p>          
          
          <div className="flex justify-center">
            <a
                href="https://laf1nte.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
            >
                Découvrir le site
            </a>
          </div>
        </div>
      </RuleSection>

      <RuleSection
        title="SPORTSYMPATHY"
        iconSrc="/images/partenaires/sportsympathy.png"
        type="default"
      >
        <div className="space-y-3">
          <p>⚽ Clavier pour supporters avec plus 5000 stickers aux couleurs du sport!</p>
          <p>🔥 Le clavier SportSympathy regroupe des emojis aux thèmes de 130 équipes de football.</p>        

          <div className="flex justify-center gap-4">
            <a
              href="https://play.google.com/store/apps/details?id=com.sportsympathy.sportsympathy&utm_source=emea_Med"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
            >
              Appli pour Android
            </a>
            <a
              href="https://apps.apple.com/fr/app/sportsympathy/id6504397730"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
            >
              Appli pour iOS
            </a>
          </div>
        </div>
      </RuleSection>

    </main>
  );
}
