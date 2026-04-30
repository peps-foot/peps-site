// components/CompetitionRules.tsx

type CompetitionRulesProps = {
  mode?: string | null;
  gameType?: string | null;
  xpEnabled?: boolean;
  allowedBonuses?: string[];
};

import RuleSection from '../components/RuleSection'

const BONUS_MAP: Record<string, string> = {
  "02040012-e79d-4b66-bb39-7615025894f3": "BOOST_2",
  "3581dea7-f960-4673-abdd-8d3a0198835a": "RIBERY",
  "68cb5935-c2df-4b88-bbbf-242022aa7fbf": "BUTS",
  "6d7b9ab9-f38e-46a3-a747-dc0706611436": "CLEAN SHEET",
  "7c48a777-f567-4132-9cb9-6783daee956a": "ZLATAN",
  "889f15b3-8cbb-4ee2-ac23-dccaa90cf747": "KANTE",
  "b432ea6b-b196-46c2-b00c-577f89d15778": "BOOST_3",
  "c57b5f18-31d0-4f3d-8342-37aa033dd109": "ECART",
  "cee1eccc-28bf-4cbf-9968-2e7479d3b19f": "BIELSA",
  "e0bc5870-6b77-40ec-876a-ef0a14140f36": "BOOST_1",
};

export default function CompetitionRules({
  mode,
  gameType,
  xpEnabled = false,
  allowedBonuses = [],
}: CompetitionRulesProps) {
  const bonusCodes = allowedBonuses
    .map((id) => BONUS_MAP[id])
    .filter(Boolean);

  const hasBonus = (code: string) => bonusCodes.includes(code);

  return (
    <main className="px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-center">
        RÈGLES DU JEU
      </h1>

      <RuleBase />

      {mode === "CLASSIC" && <RuleModeClassic />}
      {mode === "TOURNOI" && <RuleModeTournoi />}

      {xpEnabled && <RuleXP />}

      {hasBonus("KANTE") && <RuleBonusKante />}
      {hasBonus("RIBERY") && <RuleBonusRibery />}
      {hasBonus("ZLATAN") && <RuleBonusZlatan />}
      {hasBonus("BIELSA") && <RuleBonusBielsa />}

      {hasBonus("BUTS") && <RuleBonusButs />}
      {hasBonus("CLEAN SHEET") && <RuleBonusCleanSheet />}
      {hasBonus("ECART") && <RuleBonusEcart />}

      {(hasBonus("BOOST_1") || hasBonus("BOOST_2") || hasBonus("BOOST_3")) && (
        <RuleBonusBoost />
      )}
    </main>
  );
}

// 3 accordéons pour les règles de bases
function RuleBase() {
  return (
    <>
      <RuleResume />
      <RuleLexique />
      <RulePrincipales />
    </>
  );
}

// Résumé en moins d'une minute
function RuleResume() {
  return (
      <RuleSection title="Résumé en moins d’une minute" iconSrc="/images/regles/chrono.png" type="default">
        <p className="mb-4 text-justify">
          Pour chaque match, parie sur la victoire à domicile, le match nul ou la victoire à l’extérieur
          (comme le 1-N-2 au Lotofoot) et marque un maximum de points pour grimper dans le classement.
        </p>

        <p className="mb-4 text-justify">
          Les points dépendent de la difficulté du pronostic. Plus le pari est risqué, plus il rapporte de points.
        </p>

        <p className="mb-4 font-semibold text-justify">Un p'tit exemple :</p>

        <div className="flex justify-center my-4">
          <img
            src="/images/regles/ex_resume.png"
            alt="regles_resume"
            className="w-full max-w-lg rounded-lg border"
          />
        </div>

        <p className="mt-4 text-justify">
          Si tu paries sur N et que le classico se termine sur un match nul (on ne veut froisser personne) ça te fait 11 points.
          S'il n'y a pas match nul, tu ne gagnes pas de points. Simple, non ?
        </p>

        <p className="mt-4 text-justify">
          Pour rendre le jeu plus sympa, on a rajouté des bonus qui te permettront de pouvoir gagner plus de points si tu les places bien.
        </p>
      </RuleSection>
  );
}

// Lexique
function RuleLexique() {
  return (
      <RuleSection title="Match, grille... on t'explique tout !" iconSrc="/images/regles/emoji.png" type="default">
        <p className="mb-4 text-justify">
            Pas de panique, on ne va pas revenir sur la règle du hors-jeu mais juste définir quelques mots importants du jeu :
          </p>
          <p className="mb-4">Un <strong>MATCH</strong> est défini par plusieurs infos :</p>
          <div className="flex justify-center my-4">
            <img src="/images/regles/ex_lexique.png" alt="regles_lexique" className="w-full max-w-lg rounded-lg border" />
          </div>
          <ul className="list-disc pl-5 mb-4 text-justify">
            <li>La date et l’heure du coup d’envoi de la rencontre et le statut du match qui évolue en live.</li>
            <li>L’équipe à gauche est celle qui joue à domicile, celle de droite joue à l’extérieur. Le score en live s’affiche quand le match est commencé.</li>
            <li>Tu peux cliquer sur les cases 1-N-2 pour y mettre tes croix (ton <strong>PRONO</strong>) sans avoir besoin d’enregistrer.</li>
            <li>Les valeurs en dessous correspondent aux <strong>POINTS</strong> à gagner.</li>
            <li>En cliquant sur l’image VAR, tu verras les pronos des autres joueurs si le match a commencé.</li>
            <li>En dessous, tu verras en live les points que tu gagnes, de quoi vibrer pendant tout le match.</li>
          </ul>

          <p className="mb-2 text-justify">Une <strong>GRILLE</strong> est composée de plusieurs <strong>MATCHS</strong>, généralement ceux d’une journée de Ligue 1.</p>
          <p className="mb-4 text-justify">Une <strong>COMPET</strong> regroupe plusieurs GRILLES. Elle peut se jouer en mode <strong>CLASSIC</strong> ou en mode <strong>TOURNOI</strong>.</p>
      </RuleSection>
  );
}

// Les 4 règles principales
function RulePrincipales() {
  return (
      <RuleSection title="Les 4 règles principales" iconSrc="/images/regles/etoile.png" type="default">
        <ul className="list-disc pl-5 space-y-2 text-justify">
          <li><strong>Règle 1 :</strong> Seul le score à la fin du temps réglementaire compte (pas de prolongations, ni de tirs au but).</li>
          <li><strong>Règle 2 :</strong> Une seule croix par match, sauf si un bonus est joué.</li>
          <li><strong>Règle 3 :</strong> Si ce n'est pas affiché, le stock de chaque bonus est illimité.</li>
          <li><strong>Règle 4 :</strong> Tu peux changer ton choix jusqu'au coup d’envoi.</li>
        </ul>
      </RuleSection>
  );
}

// Pour le mode CLASSIC
function RuleModeClassic() {
  return (
    <RuleSection title="Le mode CLASSIC" iconSrc="/images/regles/mode.png" type="default">
      <p className="mt-2 text-justify">
        En mode <strong>CLASSIC</strong>, tu joues plusieurs grilles et tu accumules un maximum de points pour grimper dans le classement.
      </p>

      <p className="mt-4 text-justify">
        La saison de 34 journées est découpée en plusieurs <strong>COMPETS</strong> de 9 grilles,
        correspondant aux grandes périodes de l’année.
      </p>

      <ul className="list-disc pl-5 mt-2 space-y-2 text-justify">
        <li><strong>J1 → J9 :</strong> Compet d’Été</li>
        <li><strong>J10 → J17 :</strong> Compet d’Automne</li>
        <li><strong>J18 → J25 :</strong> Compet d’Hiver</li>
        <li><strong>J26 → J34 :</strong> Compet de Printemps</li>
      </ul>

      <p className="mt-4 text-justify">
        À chaque grille, marque des points grâce à tes pronos et tes bonus pour te rapprocher du sommet.
      </p>

      <p className="mt-4 font-semibold">
        🎯 Objectif : finir en tête du classement !
      </p>
    </RuleSection>
  );
}

// Pour le mode TOURNOI
function RuleModeTournoi() {
  return (
    <RuleSection title="Le mode TOURNOI" iconSrc="/images/regles/mode.png" type="default">
      <p className="mt-2 text-justify">
        En mode <strong>TOURNOI</strong>, l’objectif est simple : survivre le plus longtemps possible.
        À chaque grille, des joueurs sont éliminés… et il ne restera qu’un seul gagnant !
      </p>

      <p className="mt-4 font-semibold text-justify">
        Il existe trois types de tournois :
      </p>

        <ul className="list-disc pl-5 space-y-3 text-justify mt-2">
        <li>
            <strong>KOH LANTA :</strong> à chaque grille, les moins bons sont éliminés.
        </li>
        <li>
            <strong>SHARK GAME :</strong> à chaque grille, la moitié des joueurs est éliminée.
        </li>
        <li>
            <strong>TERMINATOR :</strong> si tu fais moins bien que l’IA, tu es éliminé.
        </li>
        </ul>

      <p className="mt-4 text-justify">
        Plus tu avances dans le tournoi, plus la pression monte… alors assure tes pronos !
      </p>

      <p className="mt-4 font-semibold">
        🎯 Objectif : être le dernier survivant !
      </p>
    </RuleSection>
  );
}

// Explication points XP
function RuleXP() {
  return (
      <RuleSection title="Les points d'expérience" iconSrc="/images/regles/xp.png" type="default"
      >
        <p className="mt-2 text-justify">
          Les points d’expérience (XP) te permettent de progresser dans ta carrière sur PEPS.
          Plus tu performes, plus tu montes de niveau !
        </p>

        <p className="mt-4 font-semibold">Comment gagner des XP ?</p>

        <ul className="list-disc pl-5 space-y-2 text-justify mt-2">
          <li>
            <strong>Sur une grille :</strong> les 10 premiers gagnent entre 1 et 10 XP.
          </li>
          <li>
            <strong>À la fin d’une compétition :</strong> les 20 premiers gagnent entre 1 et 40 XP.
          </li>
          <li>
            <strong>En mode tournoi :</strong> chaque tour passé te rapporte 5 XP.
          </li>
        </ul>

        <p className="mt-4 text-justify">
          Tous tes XP sont cumulés pour définir ton niveau de carrière.
        </p>

        <p className="mt-4 text-justify">
          Tu es ensuite classé dans des catégories comme :
          <strong> Amateur, Espoir, Confirmé, Challenger...</strong>.
        </p>

        <p className="mt-4 text-justify">
          Retrouve ton classement dans l’onglet <strong>Carrière</strong> !
        </p>

        <p className="mt-4 font-semibold">
          🎯 Objectif : devenir une LÉGENDE de PEPS !
        </p>
      </RuleSection>
  );
}

// Bonus KANTE
function RuleBonusKante() {
  return (
      <RuleSection title="Le bonus KANTÉ" iconSrc="/images/kante.png" type="bonus_match">
        <p className="mt-2 text-justify"><strong>Description :</strong> Quand N’golo joue dans ton équipe c’est comme si tu avais deux joueurs en un. Ici c’est pareil, il te permet de cocher deux croix pour un match. Au lotofoot, c’est comme un double : 1-N, N-2 ou 1-2.</p>
        <p className="mt-2 text-justify"><strong>Avantage :</strong> 2 chances sur 3 de marquer des points.</p>
        <p className="mt-2 text-justify"><strong>Inconvénient :</strong> 1 chance sur 3 de ne pas marquer de points.</p>
        <p className="mt-4 mb-4 font-semibold text-justify">Exemple :</p>
        <div className="flex justify-center my-4">
          <img src="/images/regles/ex_kante.png" alt="Exemple Kanté" className="w-full max-w-lg rounded-lg border" />
        </div>
        <ul className="list-disc pl-5 space-y-2 text-justify">
        <li>Si Rennes gagne, tu gagnes 7 points.</li>
        <li>Si il y a match nul, tu gagnes 10 points.</li>
        <li>Si Rennes perd, tu ne gagnes pas de points !</li>
        </ul>
      </RuleSection>
  );
}

// Bonus RIBERY 
function RuleBonusRibery() {
  return (
      <RuleSection title="Le bonus RIBERY" iconSrc="/images/ribery.png" type="bonus_match">
        <p className="mt-2 text-justify"><strong>Description :</strong> On a demandé à Francky de jouer une Kanté mais il n’a pas tout compris. Il a bien rajouté une croix supplémentaire sur la grille mais il a oublié de parier sur un match. Au lotofoot, c’est un triple : 1-N-2</p>
        <p className="mt-2 text-justify"><strong>Avantage :</strong> T'es sûr de marquer des points.</p>
        <p className="mt-2 text-justify"><strong>Inconvénient :</strong> Ça te fait un match en moins à parier.</p>
        <p className="mt-4 mb-4 font-semibold text-justify">Exemple :</p>
        <div className="flex justify-center my-4">
          <img src="/images/regles/ex_ribery_1.png" alt="Exemple Ribery 1" className="w-full max-w-lg rounded-lg border" />
        </div>
        <div className="flex justify-center my-4">
          <img src="/images/regles/ex_ribery_2.png" alt="Exemple Ribery 2" className="w-full max-w-lg rounded-lg border" />
        </div>
        <ul className="list-disc pl-5 space-y-2 text-justify">
        <li>Si Metz gagne, tu gagnes 9 points.</li>
        <li>Si il y a match nul, tu gagnes 11 points.</li>
        <li>Si Nantes gagne, tu gagnes 8 points.</li>
        <li>Pour Lille - Lens, tu es sûr de marquer 0 point.</li>        
        </ul>
      </RuleSection>
  );
}

// Bonus ZLATAN
function RuleBonusZlatan() {
  return (
      <RuleSection title="Le bonus ZLATAN" iconSrc="/images/zlatan.png" type="bonus_match">
        <p className="mt-2 text-justify"><strong>Description :</strong> T’es aussi confiant que lui ? T’es sûr du résultat final d’un match ? Ce bonus te permet de doubler les points mis en jeu.</p>
        <p className="mt-2 text-justify"><strong>Avantage :</strong> Si tu sens le bon coup, tu peux zlatanner les autres</p>
        <p className="mt-2 text-justify"><strong>Inconvénient :</strong> Si tu te trompes... bah... 0 fois 2, ça fait toujours 0 hein !</p>
        <p className="mt-4 mb-4 font-semibold text-justify">Exemple :</p>
        <div className="flex justify-center my-4">
          <img src="/images/regles/ex_zlatan.png" alt="Exemple zlatan" className="w-full max-w-lg rounded-lg border" />
        </div>
        <ul className="list-disc pl-5 space-y-2 text-justify">
        <li>Si Toulouse gagne, tu gagnes 2 x 5 = 10 points.</li>
        <li>Sinon, tu ne gagnes pas de points.</li>       
        </ul>
      </RuleSection>
  );
}

// Bonus BIELSA
function RuleBonusBielsa() {
  return (
      <RuleSection title="Le bonus BIELSA" iconSrc="/images/bonus/bielsa.png" type="bonus_grille">
        <p className="mt-2 text-justify"><strong>Description :</strong> Un petit coup de folie ? Comme El loco tu veux tenter le tout pour le tout ? Si tu joues ce bonus, tu ne pourras mettre qu'une seule croix dans ta grille et les points seront multipliés par 5 !!!!! Alors, all-in ?</p>
        <p className="mt-2 text-justify"><strong>Avantage :</strong> Une chance sur trois de marquer beaucoup de points d'un coup.</p>
        <p className="mt-2 text-justify"><strong>Inconvénient :</strong> Deux chances sur trois de faire un zéro pointé !</p>
        <p className="mt-4 mb-4 font-semibold text-justify">Exemple :</p>
        <div className="flex justify-center my-4">
          <img src="/images/regles/ex_resume.png" alt="Exemple bielsa" className="w-full max-w-lg rounded-lg border" />
        </div>
        <ul className="list-disc pl-5 space-y-2 text-justify">
        <li>Si le classico OM-PSG se termine par un match nul, tu marques 5 x 11 = 55 points.</li>
        <li>Si il n'y a pas match nul, ça te fait 0 point.</li>       
        </ul>
        <p className="mt-4 mb-4 font-semibold text-justify">Remarques :</p>
        <ul className="list-disc pl-5 space-y-2 text-justify">
        <li> Ce bonus ne peut être joué une seule fois pas compétition.</li>
        <li> Ce bonus peut être joué avec le bonus BUTS.</li>
        </ul>  
      </RuleSection>
  );
}

// Bonus BUTS
function RuleBonusButs() {
  return (
      <RuleSection title="Le bonus BUTS" iconSrc="/images/bonus/buts.png" type="bonus_score">
        <p className="mt-2 text-justify"><strong>Description :</strong> Tu sens le match avec une attaque en feu et/ou une défense en carton ? Tu sens le gros score ? Ce bonus te fait gagner un point par but marqué dans le match.</p>
        <p className="mt-2 text-justify"><strong>Avantage :</strong> Sauf un 0-0, t'es sûr de marquer au moins un point en plus.</p>
        <p className="mt-2 text-justify"><strong>Inconvénient :</strong> C'est dur de marquer beaucoup de points.</p>
        <p className="mt-4 mb-4 font-semibold text-justify">Exemple :</p>
        <div className="flex justify-center my-4">
          <img src="/images/regles/ex_buts.png" alt="Exemple buts" className="w-full max-w-lg rounded-lg border" />
        </div>
        <ul className="list-disc pl-5 space-y-2 text-justify">
        <li>Score 2-2 : tu marques 12 + 2 + 2 = 16 points.</li>
        <li>Score 3-1 : tu marques 0 + 3 + 1 = 4 points.</li>
        <li>Score 0-2 : tu marques 0 + 0 + 2 = 2 points.</li>       
        </ul>
        <p className="mt-4 mb-4 font-semibold text-justify">Remarques :</p>
        <ul className="list-disc pl-5 space-y-2 text-justify">
        <li> Ce bonus marche même si ton prono est faux.</li>
        <li> Ce bonus peut être joué avec le bonus BIELSA.</li>
        </ul>       
        
      </RuleSection>
  );
}

// Bonus CLEAN SHEET
function RuleBonusCleanSheet() {
  return (
      <RuleSection title="Le bonus CLEAN SHEET" iconSrc="/images/bonus/CS.png" type="bonus_score">
        <p className="mt-2 text-justify"><strong>Description :</strong> Tu sens le match avec une attaque aux pieds carrés et/ou une défense en béton ? Ce bonus te fait gagner les points liés à ton prono si l'équipe ne prend pas de buts.</p>
        <p className="mt-2 text-justify"><strong>Avantage :</strong> Tu peux doubler tes points sur le match.</p>
        <p className="mt-2 text-justify"><strong>Inconvénient :</strong> Il suffit d'un but pour te faire perdre ton bonus.</p>
        <p className="mt-4 mb-4 font-semibold text-justify">Exemple :</p>
        <div className="flex justify-center my-4">
          <img src="/images/regles/ex_CS.png" alt="Exemple CS" className="w-full max-w-lg rounded-lg border" />
        </div>
        <ul className="list-disc pl-5 space-y-2 text-justify">
        <li>Score 2-0 : tu marques 6 + 6 = 12 points.</li>
        <li>Score 2-1 : tu marques 6 + 0 = 6 points.</li>
        <li>Score 0-0 : tu marques 0 + 6 = 6 points.</li>       
        </ul>
        <p className="mt-4 mb-4 font-semibold text-justify">Remarques :</p>
        <ul className="list-disc pl-5 space-y-2 text-justify">
        <li> Ce bonus peut marcher même si ton prono est faux.</li>
        <li> Ce bonus ne peut pas être joué avec le bonus BIELSA.</li>
        <li> Si ton prono est N, il faut un 0-0 pour doubler tes points.</li>
        </ul>
      </RuleSection>
  );
}

// Bonus ECART
function RuleBonusEcart() {
  return (
      <RuleSection title="Le bonus ÉCART" iconSrc="/images/bonus/ecart.png" type="bonus_score">
        <p className="mt-2 text-justify"><strong>Description :</strong> Parie sur une victoire à domicile ou à l’extérieur. Si tu as parié sur la bonne équipe et que l’écart de buts est de 2 ou plus, tu empoches les points de l’équipe qui a gagné.</p>
        <p className="mt-2 text-justify"><strong>Avantage :</strong> Permet de doubler tes points.</p>
        <p className="mt-2 text-justify"><strong>Inconvénient :</strong> Trouver la victoire ne suffit pas !</p>
        <p className="mt-4 mb-4 font-semibold text-justify">Exemple :</p>
        <div className="flex justify-center my-4">
          <img src="/images/regles/ex_ecart.png" alt="Exemple ecart" className="w-full max-w-lg rounded-lg border" />
        </div>
        <ul className="list-disc pl-5 space-y-2 text-justify">
        <li>Score 3-0 : tu marques 4 + 4 = 8 points.</li>
        <li>Score 2-1 : tu marques 4 + 0 = 4 points.</li>      
        </ul>
        <p className="mt-4 mb-4 font-semibold text-justify">Remarque :</p>
        <ul className="list-disc pl-5 space-y-2 text-justify">
        <li> Ce bonus ne peut pas être joué avec le bonus BIELSA.</li>
        </ul>
      </RuleSection>
  );
}

// Bonus BOOST
function RuleBonusBoost() {
  return (
      <RuleSection title="Les bonus BOOST" iconSrc="/images/bonus/boost_3.png" type="bonus_boost">
        <p className="mt-2 text-justify"><strong>Description :</strong> Ces bonus sont distribués aux joueurs finissant sur un podium du classement d'une grille. Ils peuvent rajouter 1, 2 ou 3 points à un futur prono dans une autre grille.</p>
        <p className="mt-2 text-justify"><strong>Avantage :</strong> Permet de faire monter les côtes.</p>
        <p className="mt-2 text-justify"><strong>Inconvénient :</strong> Si le prono est faux, tu le perds !</p>
        <p className="mt-4 mb-4 font-semibold text-justify">Exemple :</p>
        <div className="flex justify-center my-4">
          <img src="/images/regles/ex_resume.png" alt="Exemple boost" className="w-full max-w-lg rounded-lg border" />
        </div>
        <ul className="list-disc pl-5 space-y-2 text-justify">
        <li>Si le classico OM-PSG se termine par un match nul, tu marques 11 + 3 = 14 points.</li>
        <li>Si il n'y a pas match nul, ça te fait 0 point.</li>      
        </ul>
        <p className="mt-4 mb-4 font-semibold text-justify">Remarque :</p>
        <ul className="list-disc pl-5 space-y-2 text-justify">
        <li> Ce bonus ne peut pas être joué avec le bonus BIELSA.</li>
        </ul>
      </RuleSection>
  );
}