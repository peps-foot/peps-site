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
  // état local (à mettre avec tes autres useState)
  const [openTuto, setOpenTuto] = useState(false);
  // code pour rejoindre une compet privée
  const [joinCode, setJoinCode] = useState('');
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);


  useEffect(() => {
    const check = async () => {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const type = params.get('type');

      if (type === 'recovery') {
        console.log('🟡 URL de réinitialisation détectée — pas de redirection.');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('🔴 Pas de session, redirection vers /connexion');
        router.replace('/connexion');
        return;
      }

      setSessionChecked(true);
    };

    check();
  }, [router]);

  useEffect(() => {
  const loadHomeCompetitions = async () => {
    if (!sessionChecked) return;

    // 1) Récupérer l'utilisateur
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

    // 2) Appeler la RPC get_home_competitions
    const { data, error } = await supabase.rpc("get_home_competitions", {
      p_user_id: user.id,
    });

    if (error) {
      console.error("Erreur RPC get_home_competitions", error);
      setGroups({ mine: [], toJoin: [], history: [] });
      setReady(true);
      return;
    }

    // 3) On garde les lignes renvoyées par la RPC (avec flags + homeTab)
    const rows = (data ?? []).map((c: any) => ({
      ...c,
      mode: (c.mode ?? "CLASSIC") as CompetitionMode,
    })) as CompetitionWithFlags<Competition>[];

    // ✅ petit helper local pour produire un Competition[] propre
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
    }));

    // ✅ Tri 100% piloté par la RPC (homeTab)
    const mineRows = rows.filter((r) => r.homeTab === "MINE");
    const toJoinRows = rows.filter((r) => r.homeTab === "TO_JOIN");
    const historyRows = rows.filter((r) => r.homeTab === "HISTORY");

    // (optionnel) si tu utilises competitions ailleurs, tu stockes tout
    setCompetitions(toCompetitionArray(rows));

    // ✅ Plus besoin de splitCompetitions ici
    setGroups({
      mine: toCompetitionArray(mineRows),
      toJoin: toCompetitionArray(toJoinRows),
      history: toCompetitionArray(historyRows),
    });

    setReady(true);
  };

  loadHomeCompetitions();
}, [sessionChecked]);

  if (!sessionChecked) return null;

  async function handleJoinPublicCompetition(comp: { id: string; name: string }) {
    const ok = window.confirm(`Tu veux rejoindre la compétition "${comp.name}" ?`);
    if (!ok) return;

    // Récupérer l'utilisateur connecté
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("Impossible de retrouver ton compte. Merci de te reconnecter.");
      return;
    }

    // Appel de la fonction generate_grid_matches_for_user
    const { error: rpcError } = await supabase.rpc("generate_grid_matches_for_user", {
      p_compet_id: comp.id,
      p_user_id: user.id,
    });

    if (rpcError) {
      console.error(rpcError);
      alert("Impossible de rejoindre la compétition (erreur côté serveur).");
      return;
    }

    // Tout est bon : redirection vers la compét
    router.push(`/${comp.id}`);
  }

  async function handleJoinByCode() {
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
      .eq("join_code", code)
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

  function getDeadlineColor(deadline?: string | null) {
    if (!deadline) return "text-gray-700";

    const diffMs = new Date(deadline).getTime() - Date.now();

    if (diffMs <= 0) return "text-red-600";
    if (diffMs < 60 * 60 * 1000) return "text-red-600";      // < 1h
    if (diffMs < 24 * 60 * 60 * 1000) return "text-orange-500"; // < 24h

    return "text-gray-700";
  }


  return (
  <main className="px-4 py-8 max-w-3xl mx-auto">
    {/* Pub PEPS aléatoire */}
    <RandomPromo />

    <div className="space-y-4">

    {/* ── TUTO FLASH ── */}
    <div className="border rounded-lg ">
      <button
        type="button"
        onClick={() => setOpenTuto(!openTuto)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="font-semibold text-center w-full">
          ⚡ TUTO FLASH ⚡
        </span>
        <span className="text-xl">{openTuto ? '▲' : '▼'}</span>
      </button>

      {openTuto && (
        <div className="px-4 pb-4">
          <ol className="list-decimal pl-5 space-y-2 text-sm leading-6">
            <li>🏆 Choisis ta compet</li>
            <li>✖️ Mets une croix par match</li>
            <li>⭐ Joue ton bonus <span className="font-semibold">CROIX</span></li>
            <li>🎯 Joue ton bonus <span className="font-semibold">SCORE</span></li>
            <li>🚀 Joue un <span className="font-semibold">BOOST</span> si t’en as</li>
            <li>⚽ Vibre en suivant la Ligue&nbsp;1</li>
            <li>↗️ Les règles complètes en haut à droite</li>
          </ol>
        </div>
      )}
    </div>

    {/* MES COMPÉT' */}
    <details open className="group rounded-md border">
      <summary className="list-none cursor-pointer px-4 py-3 font-semibold">
        <div className="flex items-center justify-between">
          <span className="text-center w-full">🏆 MES COMPÉTITIONS</span>

          {/* flèche */}
          <span className="text-xl transition-transform group-open:rotate-180">
            ▼
          </span>
        </div>
      </summary>
      <div className="p-2">
        {mine.length === 0 && (
          <p className="px-2 py-1 text-sm text-gray-600">
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
      </div>
    </details>

    {/* COMPÉTITIONS PUBLIQUES */}
    <details open={toJoin.length > 0} className="group rounded-md border">
      <summary className="list-none cursor-pointer px-4 py-3 font-semibold">
        <div className="flex items-center justify-between">
          <span className="text-center w-full">🌍 COMPÉTITIONS PUBLIQUES</span>
          <span className="text-xl transition-transform group-open:rotate-180">▼</span>
        </div>
      </summary>

      <div className="p-2">
        {toJoin.length === 0 && (
          <p className="px-2 py-1 text-sm text-gray-600">
            Rien à rejoindre pour l’instant.
          </p>
        )}

        {toJoin.slice(0, 3).map((comp) => (
          <CompetitionHomeCard
            key={comp.id}
            comp={comp}
            onClick={() => handleJoinPublicCompetition(comp)}
            formatDeadline={formatDeadline}
            getCompetitionStatusText={getCompetitionStatusText}
            getDeadlineColor={getDeadlineColor}
          />
        ))}

        {toJoin.length > 3 && (
          <button
            type="button"
            onClick={() => router.push("/competitions")}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Voir toutes les compétitions publiques
          </button>
        )}
      </div>
    </details>

    {/* ENTRE AMIS */}
    <details className="group rounded-md border">
      <summary className="list-none cursor-pointer px-4 py-3 font-semibold">
        <div className="flex items-center justify-between">
          <span className="text-center w-full">🔒 ENTRE AMIS</span>
          <span className="text-xl transition-transform group-open:rotate-180">▼</span>
        </div>
      </summary>

      <div className="p-3 space-y-4">

        {/* CRÉER UNE COMPÉT */}
        <button
          type="button"
          onClick={() => router.push("/competition/create")}
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
              onChange={(e) => setJoinCode(e.target.value)}
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
            <p className="pt-1 text-xs text-red-600">{joinCodeError}</p>
          )}
        </div>

      </div>
    </details>

    {/* MODE SUPPORTER */}
    <details className="group rounded-md border">
      <summary className="list-none cursor-pointer px-4 py-3 font-semibold">
        <div className="flex items-center justify-between">
          <span className="text-center w-full">📣 MODE SUPPORTER</span>
          <span className="text-xl transition-transform group-open:rotate-180">▼</span>
        </div>
      </summary>

      <div className="p-3 space-y-3">
        <p className="text-sm text-gray-700 leading-5">
          Choisis ton club, pronostique ses matchs et défie les autres supporters. A venir...
        </p>
      </div>
    </details>

    {/* ANCIENNES COMPÉTITIONS */}
    <details className="group rounded-md border">
      <summary className="list-none cursor-pointer px-4 py-3 font-semibold">
        <div className="flex items-center justify-between">
          <span className="text-center w-full">🕘 ANCIENNES COMPÉTITIONS</span>
          <span className="text-xl transition-transform group-open:rotate-180">▼</span>
        </div>
      </summary>

      <div className="p-2">
        {history.length === 0 && (
          <p className="px-2 py-1 text-sm text-gray-600">
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
      </div>
    </details>

    </div>
    </main>
  );
}
