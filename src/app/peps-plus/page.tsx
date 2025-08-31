'use client';
import RuleSection from '../../components/RuleSection';
//import NotificationsSettings from '../../components/NotificationsSettings.tsx.bak';
import { Construction } from "lucide-react";

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
        <p><strong>Android :</strong> à venir très bientôt...</p>
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

      <RuleSection title="Notifications" iconSrc="/images/regles/notif.png" type="default">
      {/* <NotificationsSettings /> */}
      <p className="flex items-center space-x-2 text-gray-600">
        <Construction className="w-5 h-5 text-yellow-600" />
        <span>En chantier.</span>
      </p>       
      </RuleSection>
    </main>
  );
}
