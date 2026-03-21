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
          <span className="text-center w-full">🏆 MES COMPÉTITIONS 🏆</span>

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
        {mine.map((comp) => (
          <div
            key={comp.id}
            onClick={() => router.push(`/${comp.id}`)}
            className="bg-blue-100 rounded-md p-3 shadow cursor-pointer hover:bg-blue-200 transition flex items-center justify-between mb-2"
          >
            <div className="flex items-center space-x-3">
              <Image
                src={`/${comp.icon ?? "images/compet/placeholder.png"}`}
                alt={comp.name}
                width={48}
                height={48}
                className="h-12 w-12 rounded-full object-cover ring-1 ring-black/10"
              />
              <div>
                <p className="text-green-600 font-bold">{comp.name}</p>
                <p className="text-sm text-gray-800">{comp.mode}</p>
              </div>
            </div>
            <CompetitionStatusBadge
              competitionId={comp.id}
              mode={comp.mode}
              isMember={true}          // mine => forcément membre
            />
          </div>
        ))}
      </div>
    </details>

    {/* CRÉER UNE COMPÉT */}
    <button
      type="button"
      onClick={() => router.push("/competition/create")}
      className="w-full rounded-md bg-green-600 px-3 py-3 text-center text-sm font-semibold text-white hover:bg-green-700">
      CRÉER MA COMPÉTITION
    </button>

    {/* ✅ REJOINDRE UNE COMPÉT (PUBLIC) — toujours ouvert */}
    <details open className="group rounded-md border">
      <summary className="list-none cursor-pointer px-4 py-3 font-semibold">
        <div className="flex items-center justify-between">
          <span className="text-center w-full">➕ REJOINDRE UNE COMPÉT ➕</span>
          <span className="text-xl transition-transform group-open:rotate-180">▼</span>
        </div>
      </summary>

      <div className="p-2">

        {toJoin.length === 0 && (
          <p className="px-2 py-1 text-sm text-gray-600">
            Rien à rejoindre pour l’instant.
          </p>
        )}

        {toJoin.map((comp) => (
          <div
            key={comp.id}
            className="bg-blue-100 rounded-md p-3 shadow flex items-center justify-between mb-2"
          >
            <div className="flex items-center space-x-3">
              <Image
                src={`/${comp.icon ?? "images/compet/placeholder.png"}`}
                alt={comp.name}
                width={48}
                height={48}
                className="h-12 w-12 rounded-full object-cover ring-1 ring-black/10"
              />
              <div>
                <p className="text-green-600 font-bold">{comp.name}</p>
                <p className="text-sm text-gray-800">{comp.mode}</p>
              </div>
            </div>

            <CompetitionStatusBadge
              competitionId={comp.id}
              mode={comp.mode}
              isMember={false}
              allFT={false}
              hasNS={true}
              onClick={() => handleJoinPublicCompetition(comp)}
            />
          </div>
        ))}
      </div>
    </details>

    {/* ✅ T'AS UN CODE ?? — fermé par défaut */}
    <details className="group rounded-md border">
      <summary className="list-none cursor-pointer px-4 py-3 font-semibold">
        <div className="flex items-center justify-between">
          <span className="text-center w-full">🔑 T’AS UN CODE ?? 🔑</span>
          <span className="text-xl transition-transform group-open:rotate-180">▼</span>
        </div>
      </summary>

      <div className="p-2">
        <p className="px-2 py-1 text-sm font-semibold text-gray-700">
          Rejoindre une compétition privée avec un code
        </p>

        <div className="flex items-center gap-2 px-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Code"
            className="
              flex-1
              min-w-0
              rounded-md
              border
              px-2
              py-2
              text-sm
              uppercase
              tracking-wider
              sm:px-3
            "
          />

          <button
            type="button"
            className="
              shrink-0
              rounded-md
              bg-blue-600
              px-3
              py-2
              text-sm
              font-semibold
              text-white
              hover:bg-blue-700
              sm:px-4
            "
            onClick={handleJoinByCode}
          >
            Rejoindre
          </button>
        </div>

        {joinCodeError && (
          <p className="px-2 pt-1 text-xs text-red-600">{joinCodeError}</p>
        )}
      </div>
    </details>

    {/* HISTORIQUE */}
    <details className="rounded-md border">
      <summary className="list-none cursor-pointer px-4 py-3 font-semibold">
        <div className="flex items-center justify-between">
          <span className="text-center w-full">🕘 HISTORIQUE 🕘</span>
          <span className="text-xl">▼</span>
        </div>
      </summary>
      <div className="p-2">
        {history.length === 0 && (
          <p className="px-2 py-1 text-sm text-gray-600">
            Aucune compétition terminée.
          </p>
        )}
        {history.map((comp) => (
          <div
            key={comp.id}
            onClick={() => router.push(`/${comp.id}`)}
            className="bg-blue-100 rounded-md p-3 shadow cursor-pointer hover:bg-blue-200 transition flex items-center justify-between mb-2"
          >
            <div className="flex items-center space-x-3">
              <Image
                src={`/${comp.icon ?? "images/compet/placeholder.png"}`}
                alt={comp.name}
                width={48}
                height={48}
                className="h-12 w-12 rounded-full object-cover ring-1 ring-black/10"
              />
              <div>
                <p className="text-green-600 font-bold">{comp.name}</p>
                <p className="text-sm text-gray-800">{comp.mode}</p>
              </div>
            </div>
<CompetitionStatusBadge
  competitionId={comp.id}
  mode={comp.mode}
  allFT={true}
/>
          </div>
        ))}
      </div>
    </details>

    </div>
    </main>
  );
}
