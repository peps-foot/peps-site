'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CompetitionStatusBadge from "../components/CompetitionStatusBadge";
import supabase from '../lib/supabaseBrowser';
import Image from "next/image";
import { CompetitionMode, Competition } from '../lib/types';
import { groupCompetitionsForHome } from "../lib/competitionStatus";
import RandomPromo from '../components/RandomPromo';
import { splitCompetitions, CompetitionWithFlags } from "../lib/competitionsGrouping";
import CompetitionHomeCard from "../components/CompetitionHomeCard";
import JoinCompetitionModal from "../components/JoinCompetitionModal";
import PartnerPromo from '../components/PartnerPromo';

type Team = {
  id: number;
  name: string;
  logo: string;
};

function BannerAccordion({
  image,
  alt,
  open,
  onClick,
  dynamicText,
  children,
}: {
  image: string
  alt: string
  open: boolean
  onClick: () => void
  dynamicText?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl overflow-hidden border shadow-md bg-white">
      <button
        type="button"
        onClick={onClick}
        className="relative w-full overflow-hidden block"
      >
        <img
          src={image}
          alt={alt}
          className="w-full h-auto block"
        />

        <div className="absolute inset-0 bg-black/10" />

        {dynamicText && (
          <div className="absolute left-4 bottom-2 sm:bottom-3 text-left text-white drop-shadow-md">
            <p className="text-xs sm:text-sm font-bold">
              {dynamicText}
            </p>
          </div>
        )}
      </button>

      {open && (
        <div className="p-2 bg-white">
          {children}
        </div>
      )}
    </section>
  )
}

export default function Home() {
  const router = useRouter();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [groups, setGroups] = useState<{
    mine: Competition[];
    toJoin: Competition[];
    history: Competition[];
  }>({ mine: [], toJoin: [], history: [] });

  const [statuses, setStatuses] = useState<Map<string, {label: string; color: "blue"|"green"|"gray"; isActiveRank: boolean}>>(new Map());
  const [ready, setReady] = useState(false);
  const { mine, toJoin, history } = groups;
  //pop-up pour rejoindre une compet publique
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  // code pour rejoindre une compet privée
  const [joinCode, setJoinCode] = useState('');
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);
  //Etre logué pour rejoindre une competition
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Pour l'affichage dans les bannières
  const [openMine, setOpenMine] = useState(false)
  const [openTuto, setOpenTuto] = useState(false)
  const [openPublic, setOpenPublic] = useState(false)
  const [openFriends, setOpenFriends] = useState(false)
  const [openSupporters, setOpenSupporters] = useState(false)
  const [openArchives, setOpenArchives] = useState(false)
  // Pour le mode SUPPORTER
  const [supporterSearch, setSupporterSearch] = useState('');
  const [showAllSupporters, setShowAllSupporters] = useState(false);
  // Choix du pseudo pour un nouveau compte Google
  const [showPseudoModal, setShowPseudoModal] = useState(false);
  const [newPseudo, setNewPseudo] = useState("");
  const [pseudoError, setPseudoError] = useState<string | null>(null);
  const [isSavingPseudo, setIsSavingPseudo] = useState(false);
  const [connectedUserId, setConnectedUserId] = useState<string | null>(null);
  // Choix facultatif de l'avatar après la création du pseudo
  const [showGoogleAvatarModal, setShowGoogleAvatarModal] = useState(false);
  const [googleAvatarTeams, setGoogleAvatarTeams] = useState<Team[]>([]);
  const [googleAvatarSearch, setGoogleAvatarSearch] = useState("");
  const [isSavingGoogleAvatar, setIsSavingGoogleAvatar] = useState(false);

  useEffect(() => {
    const check = async () => {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const type = params.get("type");

      if (type === "recovery") {
        console.log("🟡 URL de réinitialisation détectée.");
        setSessionChecked(true);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      setIsLoggedIn(!!session);

      if (session?.user) {
        setConnectedUserId(session.user.id);

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Erreur vérification du profil :", profileError);
        }

        // Aucun profil ou aucun pseudo : on ouvre la pop-up obligatoire
        if (!profile?.username?.trim()) {
          setShowPseudoModal(true);
        }
      }

      setSessionChecked(true);
    };

    check();
  }, []);

  useEffect(() => {
    const loadHomeCompetitions = async () => {
      if (!sessionChecked) return;

      // CAS 1 : visiteur non connecté
      if (!isLoggedIn) {
        const { data, error } = await supabase
          .from("competitions")
          .select("id,name,description,icon,mode,game_type,kind,created_at")
          .eq("kind", "PUBLIC")
          .eq("is_open", true)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Erreur chargement compétitions publiques", error);
          setGroups({ mine: [], toJoin: [], history: [] });
          setReady(true);
          return;
        }

        const publicCompetitions = (data ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          icon: c.icon,
          mode: (c.mode ?? "CLASSIC") as CompetitionMode,
          game_type: c.game_type ?? "GRID",
          nextPredictionDeadline: null,
          hasAllNS: false,
          hasGridDone: false,
          hasAnyPickOrBonus: false,
          remainingActivePlayersCount: 0,
          isMember: false,
          canPlay: null,
          userRank: null,
          playersCount: 0,
        })) as Competition[];

        setCompetitions(publicCompetitions);

        setGroups({
          mine: [],
          toJoin: publicCompetitions,
          history: [],
        });

        setReady(true);
        return;
      }

      // CAS 2 : joueur connecté
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("Erreur user", userError);
        setGroups({ mine: [], toJoin: [], history: [] });
        setReady(true);
        return;
      }

      const { data, error } = await supabase.rpc("get_home_competitions", {
        p_user_id: user.id,
      });

      if (error) {
        console.error("Erreur RPC get_home_competitions", error);
        setGroups({ mine: [], toJoin: [], history: [] });
        setReady(true);
        return;
      }

      const rows = (data ?? []).map((c: any) => ({
        ...c,
        mode: (c.mode ?? "CLASSIC") as CompetitionMode,
      })) as CompetitionWithFlags<Competition>[];

      const toCompetitionArray = (arr: any[]): Competition[] =>
        arr.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          icon: c.icon,
          mode: (c.mode ?? "CLASSIC") as CompetitionMode,
          game_type: c.game_type ?? "GRID",
          nextPredictionDeadline: c.nextPredictionDeadline ?? null,
          hasAllNS: c.hasAllNS ?? false,
          hasGridDone: c.hasGridDone ?? false,
          hasAnyPickOrBonus: c.hasAnyPickOrBonus ?? false,
          remainingActivePlayersCount: c.remainingActivePlayersCount ?? 0,
          isMember: c.isMember ?? false,
          canPlay: c.canPlay ?? null,
          userRank: c.userRank ?? null,
          playersCount: c.playersCount ?? 0,
          displayStartDate: c.displayStartDate ?? null,
          displayEndDate: c.displayEndDate ?? null,
          displayUnitsCount: c.displayUnitsCount ?? null,
        }));

      const mineRows = rows.filter((r) => r.homeTab === "MINE");
      const toJoinRows = rows.filter((r) => r.homeTab === "TO_JOIN");
      const historyRows = rows.filter((r) => r.homeTab === "HISTORY");

      setCompetitions(toCompetitionArray(rows));

      setGroups({
        mine: toCompetitionArray(mineRows),
        toJoin: toCompetitionArray(toJoinRows),
        history: toCompetitionArray(historyRows),
      });

      setReady(true);
    };

    loadHomeCompetitions();
  }, [sessionChecked, isLoggedIn]);

  if (!sessionChecked) return null;

  async function handleJoinPublicCompetition(comp: Competition) {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }

    setSelectedComp(comp);
  }

  async function confirmJoinCompetition() {
    if (!selectedComp) return;

    setIsJoining(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("Impossible de retrouver ton compte.");
      setIsJoining(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc("generate_grid_matches_for_user", {
      p_compet_id: selectedComp.id,
      p_user_id: user.id,
    });

    if (rpcError) {
      alert("Erreur côté serveur.");
      setIsJoining(false);
      return;
    }

    router.push(`/${selectedComp.id}`);
    setIsJoining(false); // optionnel mais propre
    setSelectedComp(null); // ferme la modal
  }

  async function handleJoinByCode() {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }

    setJoinCodeError(null);

    const code = joinCode.trim();
    if (!code) {
      setJoinCodeError("Merci de saisir un code.");
      return;
    }

    // Récupérer l'utilisateur connecté
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setJoinCodeError("Impossible de retrouver ton compte. Merci de te reconnecter.");
      return;
    }

    // 1) Retrouver la compétition par le code
    const { data: comp, error: compError } = await supabase
      .from("competitions")
      .select("id, name, kind")
      .eq("join_code", code.trim().toUpperCase())
      .single();

    if (compError || !comp) {
      console.error(compError);
      setJoinCodeError("Code invalide ou compétition introuvable.");
      return;
    }

    // (Optionnel : vérifier que c'est bien une compet privée)
    if (comp.kind !== "PRIVATE") {
      setJoinCodeError("Ce code ne correspond pas à une compétition privée.");
      return;
    }

    // 2) Appeler generate_grid_matches_for_user
    const { error: rpcError } = await supabase.rpc("generate_grid_matches_for_user", {
      p_compet_id: comp.id,
      p_user_id: user.id,
    });

    if (rpcError) {
      console.error(rpcError);
      setJoinCodeError("Impossible de rejoindre cette compétition (erreur serveur).");
      return;
    }

    // 3) Tout est bon : on peut vider le code et rediriger
    setJoinCode("");
    router.push(`/${comp.id}`);
  }

  async function handleSaveGooglePseudo() {
    setPseudoError(null);

    const cleanPseudo = newPseudo.trim();

    if (cleanPseudo.length < 3 || cleanPseudo.length > 15) {
      setPseudoError("Le pseudo doit contenir entre 3 et 15 caractères.");
      return;
    }

    if (!connectedUserId) {
      setPseudoError("Impossible de retrouver ton compte.");
      return;
    }

    setIsSavingPseudo(true);

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: connectedUserId,
          username: cleanPseudo,
          avatar: null,
        },
        {
          onConflict: "user_id",
        }
      );

    if (error) {
      console.error("Erreur création du profil :", error);

      if (error.code === "23505") {
        setPseudoError("Ce pseudo est déjà utilisé. Choisis-en un autre.");
      } else {
        setPseudoError("Impossible d'enregistrer ton pseudo.");
      }

      setIsSavingPseudo(false);
      return;
    }

    setShowPseudoModal(false);
    setIsSavingPseudo(false);

    // Charger les équipes pour la deuxième étape
    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("id, name, logo")
      .order("name");

    if (teamsError) {
      console.error("Erreur chargement des avatars :", teamsError);

      // Le profil est quand même créé, on ne bloque pas le joueur
      return;
    }

    setGoogleAvatarTeams(teamsData ?? []);
    setShowGoogleAvatarModal(true);
  }

  async function handleChooseGoogleAvatar(logo: string) {
    if (!connectedUserId) {
      alert("Impossible de retrouver ton compte.");
      return;
    }

    setIsSavingGoogleAvatar(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        avatar: logo,
      })
      .eq("user_id", connectedUserId);

    if (error) {
      console.error("Erreur enregistrement avatar :", error);
      alert("Impossible d'enregistrer cet avatar.");
      setIsSavingGoogleAvatar(false);
      return;
    }

    setShowGoogleAvatarModal(false);
    setIsSavingGoogleAvatar(false);
  }

  // Pour afficher le status du joueur
  function getCompetitionStatusText(comp: Competition) {
    if (!comp.isMember) return "À VENIR";
    if (comp.hasAllNS) return "À VENIR";

    if (comp.mode === "TOURNOI") {
      if (comp.canPlay === false) return "ÉLIMINÉ";

      if (comp.hasGridDone && !comp.hasAnyPickOrBonus) return "SPECTATEUR";

      if (comp.remainingActivePlayersCount === 1) return "VAINQUEUR";

      return "QUALIFIÉ";
    }

    return "CLASSEMENT";
  }

  // Pour la DEAD-LINE
  function formatDeadline(deadline?: string | null) {
    if (!deadline) return "À jour";

    const diffMs = new Date(deadline).getTime() - Date.now();

    if (diffMs <= 0) return "Maintenant";

    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days >= 1) return `Dans ${days}j ${hours}h`;
    if (hours >= 1) return `Dans ${hours}h${minutes.toString().padStart(2, "0")}`;

    return `Dans ${minutes}min`;
  }

  const sortedMine = [...mine].sort((a, b) => {
  const aTime = a.nextPredictionDeadline
    ? new Date(a.nextPredictionDeadline).getTime()
    : Infinity;

  const bTime = b.nextPredictionDeadline
    ? new Date(b.nextPredictionDeadline).getTime()
    : Infinity;

  return aTime - bTime;
  });

  // Compétitions publiques classiques : GRID + TIERCE
  const publicToJoin = toJoin.filter(
    (comp) => comp.game_type !== 'SUPPORTER'
  );

  // Compétitions SUPPORTER
  const supporterToJoin = toJoin.filter(
    (comp) => comp.game_type === 'SUPPORTER'
  );

  const filteredSupporterToJoin = supporterToJoin.filter((comp) =>
    comp.name.toLowerCase().includes(supporterSearch.toLowerCase())
  );

  const visibleSupporterToJoin =
    showAllSupporters || supporterSearch.trim()
      ? filteredSupporterToJoin
      : filteredSupporterToJoin.slice(0, 8);

  // Tri des compétitions publiques par deadline
  const sortedToJoin = [...publicToJoin].sort((a, b) => {
    const aTime = a.nextPredictionDeadline
      ? new Date(a.nextPredictionDeadline).getTime()
      : Infinity;

    const bTime = b.nextPredictionDeadline
      ? new Date(b.nextPredictionDeadline).getTime()
      : Infinity;

    return aTime - bTime;
  });

  // Pour choisir les avatar
  const filteredGoogleAvatarTeams = googleAvatarTeams.filter((team) =>
    team.name.toLowerCase().includes(googleAvatarSearch.toLowerCase())
  );

  function getDeadlineColor(deadline?: string | null) {
    if (!deadline) return "text-gray-700";

    const diffMs = new Date(deadline).getTime() - Date.now();

    if (diffMs <= 0) return "text-red-600";
    if (diffMs < 60 * 60 * 1000) return "text-red-600";      // < 1h
    if (diffMs < 24 * 60 * 60 * 1000) return "text-orange-500"; // < 24h

    return "text-gray-700";
  }

  // Pour bannières "mes compétitions"
  const mineCount = mine.length

  const mineCountText =
    mineCount === 0
      ? "Aucune compétition en cours"
      : mineCount === 1
      ? "1 compétition en cours"
      : `${mineCount} compétitions en cours`

  // Début du JSX
  return (
  <main className="px-4 py-2 max-w-3xl mx-auto">
    <div className="space-y-2">

    {/* Pub PEPS aléatoire */}
    {/*<RandomPromo /> */}

    {/* COMMENT JOUER */}
    <BannerAccordion
      image="/images/bannieres/comment_jouer.png"
      alt="Comment jouer"
      open={openTuto}
      onClick={() => setOpenTuto(!openTuto)}
    >
      <div className="-mx-4 -my-2">
        <img
          src="/images/bannieres/cdm.png"
          alt="Coupe du Monde"
          className="w-full block"
        />
      </div>
    </BannerAccordion>

    {/* MES COMPÉTITIONS */}
    <section className="rounded-xl overflow-hidden border shadow-md bg-white">
      <BannerAccordion
        image="/images/bannieres/mes_competitions.png"
        alt="Mes compétitions"
        open={openMine}
        onClick={() => setOpenMine(!openMine)}
        dynamicText={mineCountText}
      >
        {mine.length === 0 && (
          <p className="px-2 py-2 text-sm text-gray-600">
            Aucune pour le moment.
          </p>
        )}

        {sortedMine.map((comp) => (
          <CompetitionHomeCard
            key={comp.id}
            comp={comp}
            onClick={() => router.push(`/${comp.id}`)}
            formatDeadline={formatDeadline}
            getCompetitionStatusText={getCompetitionStatusText}
            getDeadlineColor={getDeadlineColor}
          />
        ))}
      </BannerAccordion>
    </section>

    {/* ── RELÈVE LE DÉFI ── */}
    <BannerAccordion
      image="/images/bannieres/releve_le_defi.png"
      alt="Relève le défi"
      open={openPublic}
      onClick={() => setOpenPublic(!openPublic)}
      dynamicText={
        sortedToJoin.length === 0
          ? "Aucune compétition disponible"
          : sortedToJoin.length === 1
            ? "1 compétition disponible"
            : `${sortedToJoin.length} compétitions disponibles`
      }
    >
      {sortedToJoin.length === 0 ? (
        <p className="px-2 py-2 text-sm text-gray-600">
          Aucune compétition publique n'est disponible pour le moment.
        </p>
      ) : (
        sortedToJoin.map((comp) => (
          <CompetitionHomeCard
            key={comp.id}
            comp={comp}
            onClick={() => handleJoinPublicCompetition(comp)}
            formatDeadline={formatDeadline}
            getCompetitionStatusText={getCompetitionStatusText}
            getDeadlineColor={getDeadlineColor}
          />
        ))
      )}
    </BannerAccordion>

    {/* ── ENTRE POTES ── */}
    <BannerAccordion
      image="/images/bannieres/entre_potes.png"
      alt="Entre potes"
      open={openFriends}
      onClick={() => setOpenFriends(!openFriends)}
    >
      <div className="p-3 space-y-4">

        {/* CRÉER UNE COMPÉT */}
        <button
          type="button"
          onClick={() => {
            if (!isLoggedIn) {
              setShowAuthModal(true);
              return;
            }

            router.push("/competition/create");
          }}
          className="w-full rounded-md bg-green-600 px-3 py-3 text-sm font-semibold text-white hover:bg-green-700"
        >
          Créer une compétition
        </button>

        {/* REJOINDRE PAR CODE */}
        <div>
          <p className="px-1 pb-1 text-sm font-semibold text-gray-700">
            Rejoindre avec un code
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Code"
              className="flex-1 min-w-0 rounded-md border px-2 py-2 text-sm uppercase tracking-wider"
            />

            <button
              type="button"
              className="shrink-0 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              onClick={handleJoinByCode}
            >
              OK
            </button>
          </div>

          {joinCodeError && (
            <p className="pt-1 text-xs text-red-600">
              {joinCodeError}
            </p>
          )}
        </div>

      </div>
    </BannerAccordion>

    {/* ── ENTRE SUPPORTERS ── */}
    <BannerAccordion
      image="/images/bannieres/entre_supporters.png"
      alt="Entre supporters"
      open={openSupporters}
      onClick={() => setOpenSupporters(!openSupporters)}
      dynamicText={
        supporterToJoin.length === 0
          ? "Aucune compétition disponible"
          : supporterToJoin.length === 1
            ? "1 compétition disponible"
            : `${supporterToJoin.length} compétitions disponibles`
      }
    >
      <div className="p-2 bg-white space-y-2">
        <input
          type="text"
          value={supporterSearch}
          onChange={(e) => setSupporterSearch(e.target.value)}
          placeholder="Rechercher une compétition..."
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />

        {visibleSupporterToJoin.length === 0 ? (
          <p className="px-2 py-2 text-sm text-gray-600">
            Aucune compétition supporters n'est disponible pour le moment.
          </p>
        ) : (
          <>
            {visibleSupporterToJoin.map((comp) => (
              <CompetitionHomeCard
                key={comp.id}
                comp={comp}
                onClick={() => handleJoinPublicCompetition(comp)}
                formatDeadline={formatDeadline}
                getCompetitionStatusText={getCompetitionStatusText}
                getDeadlineColor={getDeadlineColor}
              />
            ))}

            {!showAllSupporters &&
              !supporterSearch.trim() &&
              filteredSupporterToJoin.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllSupporters(true)}
                  className="w-full text-sm font-semibold text-blue-600 py-2"
                >
                  Voir toutes les compétitions
                </button>
              )}
          </>
        )}
      </div>
    </BannerAccordion>

    {/* ── ARCHIVES PEPS ── */}
    <BannerAccordion
      image="/images/bannieres/archives_peps.png"
      alt="Archives PEPS"
      open={openArchives}
      onClick={() => setOpenArchives(!openArchives)}
    >
      {history.length === 0 && (
        <p className="px-2 py-2 text-sm text-gray-600">
          Aucune compétition terminée.
        </p>
      )}

      {history.map((comp) => (
        <CompetitionHomeCard
          key={comp.id}
          comp={comp}
          onClick={() => router.push(`/${comp.id}`)}
          formatDeadline={formatDeadline}
          getCompetitionStatusText={getCompetitionStatusText}
          getDeadlineColor={getDeadlineColor}
        />
      ))}
    </BannerAccordion>

    {/* Pub SportSympathy aléatoire */}
    <PartnerPromo />  

    {/* ── POP UP CHOIX DU PSEUDO GOOGLE ── */}
    {showPseudoModal && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
          <h2 className="text-center text-xl font-bold">
            Bienvenue sur PEPS !
          </h2>

          <p className="mt-2 text-center text-sm text-gray-600">
            Choisis le pseudo qui sera affiché dans les classements.
          </p>

          <label className="mt-5 block text-sm font-semibold">
            Ton pseudo
          </label>

          <input
            type="text"
            value={newPseudo}
            onChange={(e) => {
              setNewPseudo(e.target.value);
              setPseudoError(null);
            }}
            maxLength={15}
            placeholder="Entre 3 et 15 caractères"
            autoFocus
            className="mt-1 w-full rounded-lg border px-3 py-3"
          />

          {pseudoError && (
            <p className="mt-2 text-sm text-red-600">
              {pseudoError}
            </p>
          )}

          <button
            type="button"
            onClick={handleSaveGooglePseudo}
            disabled={isSavingPseudo}
            className={`mt-5 w-full rounded-lg px-4 py-3 font-semibold text-white ${
              isSavingPseudo
                ? "cursor-not-allowed bg-gray-400"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isSavingPseudo ? "Enregistrement..." : "Valider mon pseudo"}
          </button>
        </div>
      </div>
    )}

    {/* ── POP UP CHOIX FACULTATIF DE L'AVATAR GOOGLE ── */}
    {showGoogleAvatarModal && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
        <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
          <button
            type="button"
            onClick={() => setShowGoogleAvatarModal(false)}
            className="absolute top-3 right-3 text-gray-500 hover:text-black text-xl"
          >
            ✕
          </button>
          <h2 className="text-center text-xl font-bold">
            Profil créé ✅
          </h2>

          <p className="mt-2 text-center text-sm text-gray-600">
            Choisis maintenant l’équipe qui représentera ton avatar.
          </p>

          <input
            type="text"
            value={googleAvatarSearch}
            onChange={(e) => setGoogleAvatarSearch(e.target.value)}
            placeholder="Rechercher une équipe..."
            className="mt-5 w-full rounded-lg border px-3 py-3"
          />

          <div className="mt-4 grid grid-cols-4 gap-3">
            {filteredGoogleAvatarTeams.map((team) => (
              <button
                type="button"
                key={team.id}
                disabled={isSavingGoogleAvatar}
                onClick={() => handleChooseGoogleAvatar(team.logo)}
                className="flex items-center justify-center rounded-lg border p-2 hover:bg-gray-50 disabled:opacity-50"
                title={team.name}
              >
                <img
                  src={team.logo}
                  alt={team.name}
                  className="h-12 w-12 object-contain"
                />
              </button>
            ))}
          </div>

          {filteredGoogleAvatarTeams.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-500">
              Aucune équipe trouvée.
            </p>
          )}

          <button
            type="button"
            disabled={isSavingGoogleAvatar}
            onClick={() => setShowGoogleAvatarModal(false)}
            className="mt-5 w-full rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Choisir plus tard
          </button>
        </div>
      </div>
    )}

    {/* ── POP UP si joueur pas logué ── */}
    {showAuthModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-lg">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/inscription")}
              className="flex-1 rounded-md bg-green-600 px-3 py-3 text-sm font-semibold text-white hover:bg-green-700"
            >
              Créer un compte
            </button>

            <button
              type="button"
              onClick={() => router.push("/connexion")}
              className="flex-1 rounded-md bg-blue-600 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Se connecter
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAuthModal(false)}
            className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
        </div>
      </div>
    )}

    {/* POP UP VALIDATION COMPET */}
    <JoinCompetitionModal
      comp={selectedComp}
      onClose={() => setSelectedComp(null)}
      onConfirm={confirmJoinCompetition}
      loading={isJoining}
    />

    </div>
    </main>
  );
}
