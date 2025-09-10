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

    </main>
  );
}
