'use client'

import RuleSection from '../../components/RuleSection'

export default function ReglesPage() {
  return (
    <main className="px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-center">RÈGLES DU JEU</h1>

      <RuleSection title="Résumé en moins d’une minute" iconSrc="/images/regles/chrono.png" type="default">
        <p className="mb-4">
          Pour chaque match, parie sur la victoire à domicile, le match nul ou la victoire à l’extérieur
          (comme le 1-N-2 au Lotofoot) et marque un maximum de points pour grimper dans le classement.  </p>
        <p className="mb-4"> Les points dépendent de la difficulté du pronostic. Plus le pari est risqué, plus il rapporte de points.</p>
        <p className="mb-4 font-semibold">Un p'tit exemple :</p>
                <div className="flex justify-center my-4">
          <img src="/images/regles/regle_exemple.png" alt="regles_exemple" className="w-full max-w-lg rounded-lg border" />
        </div>
        <p className="mt-4">Tu gagnes 4 points si Paris gagne son match ! et si Paris fait match nul, tu pourras te mordre les doigts de ne pas avoir parié N !! Simple, non ?</p>
        <p className="mt-4">Pour rendre le jeu plus sympa, on a rajouté des bonus : Kanté, Ribery et Zlatan. Ces bonus te permettront de pouvoir gagner plus de points. Les autres bonus viendront plus tard si tu motives les gens autour de toi...</p>
      </RuleSection>

      <RuleSection title="Match, grille... on t'explique tout !" iconSrc="/images/regles/emoji.png" type="default">
        <p className="mb-4">
            Pas de panique, on ne va pas revenir sur la règle du hors-jeu mais juste définir quelques mots importants du jeu :
          </p>
          <p className="mb-2 font-semibold">Un <strong>MATCH</strong> est défini par plusieurs informations :</p>
          <ul className="list-disc pl-5 mb-4">
            <li>La date et l’heure du coup d’envoi de la rencontre et le statut du match qui évolue en live.</li>
            <li>L’équipe à gauche est celle qui joue à domicile, celle de droite joue à l’extérieur. Le score en live s’affiche quand le match est commencé.</li>
            <li>Tu peux cliquer sur les cases 1-N-2 pour y mettre tes croix (ton <strong>PRONO</strong>) sans avoir besoin d’enregistrer.</li>
            <li>Les valeurs en dessous correspondent aux <strong>POINTS</strong> à gagner.</li>
            <li>En cliquant sur l’image à droite, tu verras les pronos des autres joueurs si le match a commencé, ainsi que les points gagnés en live.</li>
          </ul>

          <p className="mb-2"><strong>Une GRILLE</strong> est composée de plusieurs MATCHS, généralement ceux d’une journée de Ligue 1.</p>
          <p className="mb-4"><strong>Une COMPET</strong> regroupe plusieurs GRILLES. Elle peut se jouer en mode <strong>CLASSIC</strong> ou en mode <strong>TOURNOI</strong>.</p>
      </RuleSection>

      <RuleSection title="Les 4 règles principales" iconSrc="/images/regles/etoile.png" type="default">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Règle 1 :</strong> Seul le score à la fin du temps réglementaire compte (pas de prolongations, ni de tirs au but).</li>
          <li><strong>Règle 2 :</strong> Une seule croix par match, sauf si un bonus est joué.</li>
          <li><strong>Règle 3 :</strong> Un seul bonus peut être utilisé par grille, pour l'instant...</li>
          <li><strong>Règle 4 :</strong> Tu peux changer ton choix jusqu'au coup d’envoi.</li>
        </ul>
      </RuleSection>

      <RuleSection title="Les modes CLASSIC et TOURNOI" iconSrc="/images/regles/mode.png" type="default" >
        <p className="mb-4">
          Pour expliquer le mode <strong>CLASSIC</strong>, faisons un peu de maths. On prend les 34 journées de Ligue 1 et on y ajoute deux tours de Coupe de France, cela nous donne 36 grilles.
          Tout est prêt pour élire les champions des 4 saisons sur des <strong>COMPETS</strong> de 9 grilles.
        </p>

        <ul className="list-disc pl-5 mb-4">
          <li>J1 =&gt; J9 : Compet d’Été</li>
          <li>J10 =&gt; J17 + CDF : Compet d’Automne</li>
          <li>J18 =&gt; J26 + CDF : Compet d’Hiver</li>
          <li>J27 =&gt; J34 : Compet de Printemps</li>
        </ul>

        <p>
          Le mode <strong>TOURNOI</strong> est en préparation, trois types de tournois à élimination vous seront proposés…
        </p>
      </RuleSection>

      <RuleSection title="Le bonus KANTÉ" iconSrc="/images/kante.png" type="bonus">
        <p><strong>Description :</strong> Quand N’golo joue dans ton équipe c’est comme si tu avais deux joueurs en un. Ici c’est pareil, il te permet de cocher deux croix pour un match. Au lotofoot, c’est comme un double : 1-N, N-2 ou 1-2.</p>
        <p className="mt-2"><strong>Avantage :</strong> 2 chances sur 3 de marquer des points.</p>
        <p className="mt-2"><strong>Inconvénient :</strong> Tu ne gagnes que les points associés au pronostic avec la plus petite cote.</p>
        <p className="mt-4 mb-4 font-semibold">Exemple :</p>
        <div className="flex justify-center my-4">
          <img src="/images/regles/exemple_kante.png" alt="Exemple Kanté" className="w-full max-w-lg rounded-lg border" />
        </div>
        <p>Si Paris gagne ou fait match nul, tu gagnes 4 points. Si Paris perd, tu ne gagnes pas de points ! </p>
      </RuleSection>

            <RuleSection title="Le bonus RIBERY" iconSrc="/images/ribery.png" type="bonus">
        <p><strong>Description :</strong> On a demandé à Francky de jouer une Kanté mais il n’a pas tout compris. Il a bien rajouté une croix supplémentaire sur la grille mais il a oublié de parier sur un match. Au lotofoot, c’est un triple : 1-N-2</p>
        <p className="mt-2"><strong>Avantage :</strong> T'es sûr de marquer des points.</p>
        <p className="mt-2"><strong>Inconvénient :</strong> Ca te fait un match en moins à parier.</p>
        <p className="mt-4 mb-4 font-semibold">Exemple :</p>
        <div className="flex justify-center my-4">
          <img src="/images/regles/exemple_ribery_1.png" alt="Exemple Ribery 1" className="w-full max-w-lg rounded-lg border" />
        </div>
        <div className="flex justify-center my-4">
          <img src="/images/regles/exemple_ribery_2.png" alt="Exemple Ribery 2" className="w-full max-w-lg rounded-lg border" />
        </div>
        <p>Si Paris gagne, tu gagnes 4 points. Si Paris fait match nul, tu gagnes 23 points. Si Paris perd, tu gagnes 42 points </p>
        <p>Pour le match Palmeiras - Botafogo, tu es sûr de ne pas marquer de points</p>
      </RuleSection>

            <RuleSection title="Le bonus ZLATAN" iconSrc="/images/zlatan.png" type="bonus">
        <p><strong>Description :</strong> T’es aussi confiant que lui ? T’es sûr du résultat final d’un match ? Ce bonus te permet de doubler les points mis en jeu.</p>
        <p className="mt-2"><strong>Avantage :</strong> Si tu sens le bon coup, tu peux zlatanner les autres</p>
        <p className="mt-2"><strong>Inconvénient :</strong> Si tu te trompes... bah... 0 fois 2, ça fait toujours 0 hein !</p>
        <p className="mt-4 mb-4 font-semibold">Exemple :</p>
        <div className="flex justify-center my-4">
          <img src="/images/regles/exemple_zlatan.png" alt="Exemple zlatan" className="w-full max-w-lg rounded-lg border" />
        </div>
        <p>Si Paris gagne, tu gagnes 8 points. Sinon, tu ne gagnes pas de points. </p>
      </RuleSection>
    </main>
  )
}
