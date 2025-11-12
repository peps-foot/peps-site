'use client';
import RuleSection from '../../components/RuleSection';

export default function PepsPlusPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">

      <RuleSection title="Contact" iconSrc="/images/regles/contact.png" type="default">
        <p>Adresse email :{" "}
            <a href="mailto:hello@peps-foot.com" className="text-blue-600 underline">hello@peps-foot.com</a>
        </p>
        <p>N’hésitez pas à nous écrire pour toute question ou retour sur le jeu !</p>
      </RuleSection>

      <RuleSection title="Site web" iconSrc="/images/regles/web.png" type="default" >
        <p>Accès direct au site : <a href="https://www.peps-foot.com" target="_blank" className="text-blue-600 underline">www.peps-foot.com</a></p>
      </RuleSection>

      <RuleSection title="Application mobile" iconSrc="/images/regles/mobile.png" type="default">
        <p><strong>Android :</strong>{" "}
          <a 
            href="https://play.google.com/store/apps/details?id=com.peps_foot.www.twa" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-600 hover:underline"
          >
            Téléchargez ici
          </a>
        </p>
        <p><strong>iOS :</strong> à venir plus tard, utilisez l'appli web ci-dessous</p>
      </RuleSection>

      <RuleSection title="Installer PEPS sur iOS" iconSrc="/images/regles/ios.png" type="default">
        <ol className="list-decimal pl-5 space-y-1">
          <li>Ouvrez Safari sur votre iPhone</li>
          <li>Allez sur <a href="https://www.peps-foot.com" className="text-blue-600 underline">www.peps-foot.com</a></li>
          <li>Appuyez sur <strong>Partager</strong> (carré avec une flèche)</li>
          <li>Choisissez <strong>“Sur l’écran d’accueil”</strong></li>
          <li>Validez : vous avez l’appli PEPS sur votre iPhone !</li>
        </ol>
      </RuleSection>
    </main>
  );
}
