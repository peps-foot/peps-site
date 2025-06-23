'use client';

type BonusParameters =
  | { picks: string[] }         // Kanté
  | { match_win: string; match_zero: string } // Ribéry
  | { pick: string };           // Zlatan

import type { User } from '@supabase/supabase-js';
import type { Grid, Match, GridBonus, BonusDef, GridWithItems, MatchWithState, RawMatchRow } from '../../lib/types';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useSupabase } from '../../components/SupabaseProvider'
import { useRouter, useSearchParams, useParams} from 'next/navigation';

const bonusLogos: Record<string,string> = {
  "KANTE": '/images/kante.png',
  "RIBERY": '/images/ribery.png',
  "ZLATAN": '/images/zlatan.png',
};

export default function HomePage() {
  console.log('[app/[competitionId]] rendu');
  const supabase = useSupabase()
  // 👉 État principal de l'utilisateur connecté (renseigné au chargement)
  const [user, setUser] = useState<User | null>(null);
  // 👉 Liste complète des grilles du joueur
  const [grids, setGrids] = useState<GridWithItems[]>([]);
  // 👉 Grille actuellement sélectionnée (par index ou en navigation)
  const [grid, setGrid] = useState<GridWithItems | null>(null);
  // 👉 Liste des matchs de la grille active
  const [matches, setMatches] = useState<MatchWithState[]>([]);
  // 👉 Définition complète des bonus disponibles (ex: KANTÉ, ZLATAN...)
  const [bonusDefs, setBonusDefs] = useState<BonusDef[]>([]);
  // 👉 Liste des bonus joués pour la grille active
  const [gridBonuses, setGridBonuses] = useState<GridBonus[]>([]);
  // 👉 Points affichés directement en base
  const [totalPoints, setTotalPoints] = useState<number>(0);
  // 👉 Bonus actuellement en cours d’édition
  const [openedBonus, setOpenedBonus] = useState<BonusDef | null>(null);
  // 👉 État du chargement global (utilisé pour l’affichage)
  const [loadingGrids, setLoadingGrids] = useState<boolean>(true);
  const [loadingGrid, setLoadingGrid] = useState<boolean>(false);
  // 👉 Gestion du popup pour les bonus Ribéry/Kanté/Zlatan
  const [popupMatch1, setPopupMatch1] = useState<string>('');
  const [popupMatch0, setPopupMatch0] = useState<string>('');
  const [popupPair, setPopupPair] = useState<'1-N' | 'N-2' | '1-2'>('1-N');
  const [popupPick, setPopupPick] = useState<'1' | 'N' | '2'>('1');
  // 👉 Gestion de navigation entre les grilles
  const searchParams  = useSearchParams();
  const pageParam = searchParams?.get('page');
  const initialPage = pageParam ? Number(pageParam) : 0;
  const [currentIdx, setCurrentIdx] = useState(initialPage);
  // Pour la navigation générale
  const hasRun = useRef(false);
  const [error, setError]           = useState<string|null>(null);
  const router        = useRouter();
  const params = useParams();
  const competitionId = params?.competitionId as string;
  const pathname = '/' + competitionId; // usePathname (supprimé)();
  // 👉 Change l’index ET met à jour l’URL en shallow routing
  const goToPage = (i: number) => {    setCurrentIdx(i);
    // Reconstruit les params en conservant les autres éventuels
    const params = new URLSearchParams(Array.from(searchParams?.entries?.() ?? []));
    params.set('page', String(i));
    router.replace(`${'/' + competitionId}?${params.toString()}`);}
  // 👉 Fonctions de navigation
  const prevGrid = () => {
    if (currentIdx > 0) goToPage(currentIdx - 1); // ← vers grille précédente
  };

  const nextGrid = () => {
    if (currentIdx < grids.length - 1) goToPage(currentIdx + 1); // → vers grille suivante
  };
  const currentGrid = grid || { title: '', description: '' }
  const [lastMatchData, setLastMatchData] = useState<RawMatchRow[]>([]);

  // 👉 Format FR pour la date
  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('fr-FR',{
      day:'2-digit', month:'2-digit',
      hour:'2-digit', minute:'2-digit'
    }).replace(/\u202F/g,' ');

  // 👉 Format FR pour le status des matchs
  const getMatchLabelAndColor = (status: string) => {
  const s = status.toUpperCase();
  if (s === 'NS') return { label: 'À venir', color: 'text-blue-600' };
  if (s === '1H') return { label: '1re mi-temps', color: 'text-orange-500' };
  if (s === 'HT') return { label: 'Mi-temps', color: 'text-orange-500' };
  if (s === '2H') return { label: '2e mi-temps', color: 'text-orange-500' };
  if (['SUSP', 'INT'].includes(s)) return { label: 'Suspendu', color: 'text-red-600' };
  if (s === 'FT') return { label: 'Terminé', color: 'text-gray-700' };
  return { label: s, color: 'text-gray-400' }; // fallback
};

  // ✅ Mise à jour unique des points au premier affichage
  useEffect(() => {
    if (!grid?.id || !user?.id) return;

    const updateOnce = async () => {
      const { error } = await supabase.rpc("update_grid_points", {
        p_grid_id: grid.id,
      });

      if (error) {
        console.error("❌ Erreur update_grid_points (init) :", error);
      } else {
        console.log("✅ update_grid_points exécuté au chargement !");
      }
    };

    updateOnce();
  }, [grid?.id, user?.id]);

  // 🍀 Initialise la grille avec des matchs à venir (ou la dernière)
  useEffect(() => {
    if (grids.length > 0 && matches.length === 0) {
      const now = new Date();

      const firstPlayableGridIdx = (grids as GridWithItems[]).findIndex(grid =>
        Array.isArray(grid.grid_items) &&
        grid.grid_items.some(item => {
          const match = matches.find(m => m.id === item.match_id);
          return match?.status === 'NS' && new Date(match.date) > now;
        })
      );

      const idx = firstPlayableGridIdx >= 0 ? firstPlayableGridIdx : 0;
      setCurrentIdx(idx); // ne déclenche pas un effet en chaîne
    }
  }, [grids]);

  // 🔁 Au premier chargement : on récupère l'utilisateur connecté et ses grilles
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const initAndLoad = async () => {
      console.log("🚨 Chargement en cours...");
      setLoadingGrids(true);

      const { data: { user }, error } = await supabase.auth.getUser();
      if (user) setUser(user);
      if (error || !user) {
        setError("Utilisateur non connecté.");
        setLoadingGrids(false);
        return;
      }

      setUser(user); // ✅ On stocke le user proprement
      await loadUserGrids(user.id); // 🎯 Charge les grilles de l'utilisateur (avec picks et points)
    };

    initAndLoad();
  }, []);

  // 📦 Charge toutes les grilles et les matchs d’un joueur, avec ses picks et ses points
  async function loadUserGrids(userId: string, initialIdx?: number) {
    let finalGrids: { grid: GridWithItems; matches: MatchWithState[] }[] = [];
    try {
      setLoadingGrids(true);

      // 1. Requête : grid_matches du joueur, avec matches + grille
      const { data: matchData, error: matchError } = await supabase
        .from("grid_matches")
        .select(`
          grid_id,
          match_id,
          pick,
          points,
          matches (
            id,
            date,
            home_team,
            away_team,
            fixture_id,
            league_id,
            base_1_points,
            base_n_points,
            base_2_points,
            score_home,
            score_away,
            status,
            is_locked,
            odd_1_snapshot,
            odd_n_snapshot,
            odd_2_snapshot,
            short_name_home,
            short_name_away
          ),
          grids (
            id,
            title,
            description,
            allowed_bonuses
          )
        `)
        .eq("user_id", userId);
        setLastMatchData(matchData as RawMatchRow[]);

      if (matchError || !matchData) {
        console.error("❌ Erreur chargement matchData :", matchError);
        setError("Erreur chargement grilles.");
        setLoadingGrids(false);
        return;
      }

      // 2. Regrouper les matchs par grille
      const groupedByGrid: Record<string, { grid: Grid; matches: MatchWithState[] }> = {};

      for (const row of matchData) {
        const gridId = row.grid_id;
        const g = row.grids as unknown as Grid;
        const m = row.matches as unknown as Match;

        if (!groupedByGrid[gridId]) {
          groupedByGrid[gridId] = {
            grid: {
              id: g.id,
              title: g.title,
              description: g.description,
              allowed_bonuses: g.allowed_bonuses ?? [],
            },
            matches: [],
          };
        }
        
        groupedByGrid[gridId].matches.push({
          ...m,
          pick: row.pick ?? undefined,
          points: row.points ?? 0,
        });
      }

      // 3. Créer la liste finale triée
      finalGrids = Object.values(groupedByGrid)
        .map((entry) => ({
          grid: entry.grid as GridWithItems,
          matches: entry.matches,
        }))
        .sort((a, b) => a.grid.title.localeCompare(b.grid.title));


      const firstGridId = finalGrids[0]?.grid.id;
      const firstMatches = (groupedByGrid[firstGridId]?.matches ?? []).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // 4. Mise à jour du state
      setGrids(finalGrids.map(f => f.grid));
      setMatches(firstMatches);

      console.log("✅ Grilles chargées :", finalGrids.map((g) => g.grid.title));
      console.log("✅ Matchs de la première grille :", firstMatches);
    } catch (e) {
      console.error("🔥 Erreur loadUserGrids", e);
      setError("Erreur lors du chargement des grilles");
    } finally {
      // 🎯 Sélection grille : soit forcer un index, soit logique normale
      if (typeof initialIdx === 'number') {
        if (initialIdx !== currentIdx) goToPage(initialIdx);
      } else {
        const now = new Date();
        let chosenIdx = finalGrids.findIndex(({ matches }) =>
          matches.some(m => m.status === 'NS' && new Date(m.date) > now)
        );

        if (chosenIdx === -1) {
          chosenIdx = finalGrids.length - 1;
        }

        if (chosenIdx !== currentIdx) goToPage(chosenIdx);
      }

      // ✅ Termine le chargement
      setLoadingGrids(false);
    }
  }

  // 🧩 Charge la grille active + les matchs + picks + points + bonus
  useEffect(() => {
    if (grids.length === 0 || !grids[currentIdx]?.id || grid?.id === grids[currentIdx].id) return;
    const gridId = grids[currentIdx].id;
    if (!gridId) return;

    (async () => {
      try {
        setLoadingGrid(true);

        // 1) Fetch de la grille active
        const { data: g, error: ge } = await supabase
          .from('grids')
          .select(`
            id,
            title,
            description,
            allowed_bonuses,
            grid_items (
              match_id
            )
          `)
          .eq('id', gridId)
          .single();

        if (ge) throw ge;
        setGrid(g);
        console.log("📦 grille active chargée :", g);
        console.log('🧠 SET GRID exécuté pour ID :', gridId, g)

        // 2) Préparer la liste des match_id à récupérer
        const ids = (g.grid_items || []).map((x: { match_id: string }) => x.match_id);
        console.log('🔍 match IDs to fetch =', ids);

        // 3) Fetch des matchs (côtes et scores)
        const { data: raws, error: re } = await supabase
          .from('matches')
          .select(`
            id,
            date,
            home_team,
            away_team,
            score_home,
            score_away,
            status,
            is_locked,
            odd_1_snapshot,
            odd_n_snapshot,
            odd_2_snapshot,
            base_1_points,
            base_n_points,
            base_2_points
          `)
          .in('id', ids)
          .order('date', { ascending: true });
        if (re) throw re;
        console.log('🔍 raws fetched =', raws);

        // 4) Fetch des picks posés dans grid_matches
        const { data: rawGridMatches, error: gmError } = await supabase
          .from('grid_matches')
          .select('id, match_id, pick, points')
          .eq('grid_id', gridId);
        if (gmError) throw gmError;
        console.log('🔍 rawGridMatches =', rawGridMatches);

        // 5) Fusionner tout pour construire le tableau final
        const clean: MatchWithState[] = (raws || []).map((m) => {
          const gm = rawGridMatches.find((gm) => gm.match_id === m.id);
          const match = m as MatchWithState;

          return {
            ...m,
            pick: gm?.pick ?? undefined,
            points: gm?.points ?? 0,
            fixture_id: match.fixture_id,
            league_id: match.league_id,
          };
        });
        console.log("🧪 test picks fusionnés :", clean.map(c => ({ id: c.id, pick: c.pick })));
        console.log("✅ Matches chargés :", clean);
        const totalPoints = clean.reduce((acc, m) => acc + (m.points || 0), 0);
        setMatches(clean);
        setTotalPoints(totalPoints);

        // 6) Fetch des bonus déjà joués pour cette grille
        const { data: gbs, error: gbe } = await supabase
          .from('grid_bonus')
          .select('id, grid_id, user_id, bonus_definition, match_id, parameters')
          .eq('grid_id', gridId);
        if (gbe) throw gbe;
        console.log('🔍 gridBonuses =', gbs);
        setGridBonuses(gbs || []);

        // 7) Fetch des définitions de bonus
        const { data: bd, error: be } = await supabase
          .from('bonus_definition')
          .select('id, code, description');
        if (be) throw be;
        setBonusDefs(bd || []);

      } catch (e: unknown) {
        console.error(e);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoadingGrid(false);
      }
    })();
  }, [currentIdx, grids]);

  // ✅ Mise à jour automatique des points (NS = rien / 1H-2H = chaque minute / FT = une seule fois)
  useEffect(() => {
    if (!grid?.id || matches.length === 0) return;

    const alreadyUpdated = { current: false };

    const interval = setInterval(async () => {
      const now = new Date();

      const matchEnCours = matches.some(
        (m) => ['1H', '2H'].includes(m.status) && m.score_home === null
      );

      const matchTerminé = matches.some((m) => m.status === 'FT');

      if (matchEnCours) {
        console.log("📡 Match en cours détecté, mise à jour des points...");
      } else if (matchTerminé && !alreadyUpdated.current) {
        console.log("✅ Match terminé (FT), mise à jour unique des points...");
        alreadyUpdated.current = true;
      } else {
        // Aucun match en cours ou terminé => on ne fait rien
        return;
      }

      const { error } = await supabase.rpc("update_grid_points", {
        p_grid_id: grid.id,
      });

      if (error) {
        console.error("❌ Erreur update_grid_points :", error);
      } else {
        console.log("✅ update_grid_points exécuté !");
      }
    }, 60_000); // toutes les 60 secondes

    return () => clearInterval(interval);
  }, [grid?.id, matches, user?.id]);

  if (loadingGrids) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <span className="text-lg">🔄 Chargement des grilles…</span>
      </main>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-600">
        ⚠ {error}
      </div>
    );
  }

  if (!grid) {
    return (
      <div className="p-6 text-orange-500">
        Aucune grille trouvée pour ce joueur.
      </div>
    );
  }

  // 🎯 handlePick : enregistre un pick (1/N/2) pour un match dans la grille
  const handlePick = async (match_id: string, pick: '1' | 'N' | '2') => {
    if (!user || !grid) return;
    console.log("📤 Envoi pick →", {
      user_id: user.id,
      grid_id: grid.id,
      match_id,
      pick
    });

    const { error } = await supabase
      .from('grid_matches')
      .upsert(
        [{
          user_id: user.id,
          grid_id: grid.id,
          match_id,
          pick
        }],
        {
          onConflict: 'user_id,grid_id,match_id'
        }
      );

    if (error) {
      console.error("❌ Erreur Supabase pick :", error);
    } else {
      console.log("✅ Pick enregistré avec succès !");
    }

    const updatedMatches = matches.map((m) =>
      m.id === match_id
        ? { ...m, pick, points: m.points ?? 0 }
        : m
    );
    setMatches(updatedMatches);
    
    const activeGrid = grids.find((g) => g.id === grid.id);
if (activeGrid && activeGrid.grid_items) {
  const matchIds = activeGrid.grid_items.map((gi) => gi.match_id);
  const refreshedMatches = lastMatchData
    .filter((row) => matchIds.includes(row.match_id))
    .map((row) => ({
      ...(row.matches as Match),
      pick: row.pick ?? undefined,
      points: row.points ?? 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  setMatches(refreshedMatches);
}
  };

  // 🎯 handleBonusValidate : applique ou modifie un bonus pour la grille active
  const handleBonusValidate = async () => {
    if (!openedBonus || !user) return;

    try {
      // 1) Log initial
      console.log('🔥 handleBonusValidate start', {
        bonusCode: openedBonus.code,
        popupMatch1, popupMatch0, popupPair, popupPick
      });

      // 2) Préparation du payload
      const payload: {
        user_id: string;
        grid_id: string;
        bonus_definition: string;
        match_id: string;
        parameters: BonusParameters;
      } = {
        user_id: user.id,
        grid_id: grid.id,
        bonus_definition: openedBonus.id,
        match_id: popupMatch1,
        parameters: { picks: [] },
      };

      // 3) Logique spécifique à chaque bonus
      switch (openedBonus.code) {
        case 'KANTE':
          if (!popupMatch1) return alert('Match requis pour Kanté');
          payload.parameters = {
            picks:
              popupPair === '1-N' ? ['1', 'N']
            : popupPair === 'N-2' ? ['N', '2']
            : ['1', '2']
          };
          break;

        case 'RIBERY':
          if (!popupMatch1 || !popupMatch0)
            return alert('Sélectionnez 2 matchs différents pour Ribéry');
          if (popupMatch1 === popupMatch0)
            return alert('Les 2 matchs doivent être différents');
          payload.match_id = popupMatch1 ?? '';
          payload.parameters = {
            match_win: popupMatch1,
            match_zero: popupMatch0
          };
          break;

        case 'ZLATAN':
          if (!popupMatch1) return alert('Match requis pour Zlatan');
          payload.parameters = {
            pick: popupPick
          };
          break;

        default:
          return alert('Bonus non reconnu : ' + openedBonus.code);
      }

      // 4) Envoi Supabase
      const { data, error: be } = await supabase
        .from('grid_bonus')
        .upsert([payload], {
          onConflict: 'user_id,grid_id'
        });

      // 🔁 Recharge les bonus pour la grille actuelle
      const { data: gbs, error: gbe } = await supabase
        .from('grid_bonus')
        .select('id, grid_id, user_id, bonus_definition, match_id, parameters')
        .eq('grid_id', grid.id);

      if (gbe) throw gbe;

      setGridBonuses(gbs || []);

      if (be) throw be;
      console.log('✅ Supabase upsert OK', data);

      // 5) Update local
      setGridBonuses(gbs => [
        ...gbs.filter(b => b.bonus_definition !== openedBonus.id),
        {
          id: crypto.randomUUID(),       
          grid_id: grid.id,               
          user_id: user.id,     
          bonus_definition: openedBonus.id,
          match_id: payload.match_id,
          parameters: payload.parameters
        }
      ]);

      // 7) Fermeture du popup
      setOpenedBonus(null);
      setPopupMatch1('');
      setPopupMatch0('');
    }
    catch (e: unknown) {
      console.error('🔥 handleBonusValidate error', e);
      alert('Erreur Supabase : ' + (e instanceof Error ? e.message : String(e)));
    }
  };
   
  // 🧨 Suppression d’un bonus (base + front + points)
  const handleBonusDelete = async () => {
    if (!openedBonus || !user) return;

    try {
      // 1) Supprimer côté base
      const { error: de } = await supabase
        .from('grid_bonus')
        .delete()
        .eq('user_id', user.id)
        .eq('grid_id', grid.id)
        .eq('bonus_definition', openedBonus.id);

      if (de) throw de;
      console.log("🗑️ Bonus supprimé en base");

      // 2) Supprimer côté front
      setGridBonuses(gbs =>
        gbs.filter(x => x.bonus_definition !== openedBonus.id)
      );

      // 3) Recharge les bonus pour la grille actuelle
      const { data: gbs, error: gbe } = await supabase
        .from('grid_bonus')
        .select('id, grid_id, user_id, bonus_definition, match_id, parameters')
        .eq('grid_id', grid.id);

      if (gbe) throw gbe;

      setGridBonuses(gbs || []);

      // 4) Reset popup
      setOpenedBonus(null);
      setPopupMatch1('');
      setPopupMatch0('');
    }
    catch (e: unknown) {
      console.error('🔥 handleBonusDelete catch', e);
      alert('Erreur suppression bonus : ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  // // 🧠 Aide bonus : savoir si un bonus a été joué, et lequel
  const isPlayed = gridBonuses.length>0;
  const playedBonusCode = bonusDefs.find(b=>b.id===gridBonuses[0]?.bonus_definition)?.code;

              //console.log("[🟧 Bandeau] grids =", grids);
              //console.log("[🟧 Bandeau] grid =", grid);
              //console.log("[🟧 Bandeau] matches =", matches);
              //console.log("[🟧 Bandeau] user =", user?.id);
              //console.log("🎯 currentGrid rendu =", currentGrid);

return (
      <>
    <main className="container mx-auto px-4 py-8">
      {/* 1) ZONE D’INFORMATION PLEIN LARGEUR */}
  {/* ── ZONE INFO ── */}
  <section className="w-full mb-8">
    <div className="bg-white rounded-lg p-6 shadow flex flex-col md:flex-row items-center">
      
      {/* 1) NAVIGATION GRILLES (← title →) */}
      <div className="w-full md:w-1/3 flex items-center justify-center space-x-4 mb-4 md:mb-0">
      {/* ← Précédent */}
      <button
        onClick={prevGrid}
        disabled={currentIdx === 0}
        className="bg-[#212121] hover:bg-gray-800 text-white rounded-full p-2 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

        {/* Nom de la grille courante */}
        <span className="text-2xl font-semibold">
          {currentGrid?.title || "Chargement..."}
        </span>

        {/* → Suivant */}
        <button
          onClick={nextGrid}
          disabled={currentIdx === grids.length - 1}
          className="bg-[#212121] hover:bg-gray-800 text-white rounded-full p-2 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 2) POINTS */}
      <div className="w-full md:w-1/3 text-center mb-4 md:mb-0">
        <span className="text-lg font-semibold">POINTS :</span>
        <span className="ml-2 text-gray-600">{totalPoints}</span>
      </div>

      {/* 3) DESCRIPTION DE LA GRILLE */}
      <div className="w-full md:w-1/3 text-right">
        <p className="text-gray-700">
          {currentGrid?.description || "Chargement..."}
        </p>
      </div>
    </div>
  </section>

      {/* 2) CONTENU PRINCIPAL : GRILLE (2/3) & BONUS (1/3) */}
      <div className="p-6 flex flex-col lg:flex-row gap-6">
        {/* ── GRILLE ── */}
        <div className="w-full lg:w-2/3">
          <div className="border rounded-lg space-y-2">
            <div className="space-y-1">
              {loadingGrid ? (
                <div className="p-6 text-center">🔄 Chargement de la grille…</div>
              ) : (
                matches.map((m) => {
                  const upperStatus = m.status?.toUpperCase?.() ?? '';

                  // 1) Bonus actif
                  const bonusEntry = gridBonuses[0];
                  const bonusDef = bonusDefs.find(d => d.id === bonusEntry?.bonus_definition);
                  const bonusCode = bonusDef?.code || '';
                  const params = bonusEntry?.parameters || {};
                  const matchWin = (params as Partial<{ match_win: string }>).match_win ?? '';
                  const matchZero = (params as Partial<{ match_zero: string }>).match_zero ?? '';

                  // 2) Prépare picks et disabled
                  let picksForThisMatch: string[] =
                    bonusEntry && bonusCode
                      ? [] // sera écrasé dans le switch bonus
                      : m.pick ? [m.pick] : [];

                  let isDisabled = false;
                  if (upperStatus !== 'NS' || ['SUSP', 'INT'].includes(upperStatus) || m.is_locked) {
                    isDisabled = true;
                  }

                  if (bonusEntry && bonusCode) {
                    switch (bonusCode) {
                      case 'RIBERY': {
                        if ('match_win' in params && 'match_zero' in params) {
                          if (m.id === params.match_win) {
                            picksForThisMatch = ['1', 'N', '2'];
                            isDisabled = true;
                          } else if (m.id === params.match_zero) {
                            picksForThisMatch = [];
                            isDisabled = true;
                          } else {
                            picksForThisMatch = m.pick ? [m.pick] : [];
                          }
                        }
                        break;
                      }

                      case 'KANTE': {
                        const matchK = bonusEntry.match_id;
                        if (m.id === matchK && 'picks' in params && Array.isArray(params.picks)) {
                          picksForThisMatch = params.picks;
                          isDisabled = true;
                        } else {
                          picksForThisMatch = m.pick ? [m.pick] : [];
                        }
                        break;
                      }

                      case 'ZLATAN': {
                        const matchZ = bonusEntry.match_id;
                        if (m.id === matchZ && 'pick' in params && typeof params.pick === 'string') {
                          picksForThisMatch = [params.pick];
                          isDisabled = true;
                        } else {
                          picksForThisMatch = m.pick ? [m.pick] : [];
                        }
                        break;
                      }

                      default: {
                        picksForThisMatch = m.pick ? [m.pick] : [];
                        break;
                      }
                    }
                  }

                  return (
                    <div
                      key={m.id}
                      className="border rounded-lg grid grid-cols-7 grid-rows-2 items-center p-1"
                    >
                      {/* LIGNE 1 */}
                      <div className="text-center text-sm">{fmtDate(m.date)}</div>
                          <span className="inline sm:hidden">{m.short_name_home}</span>
                          <span className="hidden sm:inline">{m.home_team}</span>
                      {(['1', 'N', '2'] as const).map((opt) => {
                        const isX = picksForThisMatch.includes(opt)
                        return (
                          <div
                            key={opt}
                            onClick={() =>
                              !isDisabled && handlePick(m.id, opt)
                            }
                            className={`w-8 h-8 mx-auto border rounded flex items-center justify-center text-sm 
                              ${isDisabled ? 'opacity-50' : 'cursor-pointer'
                            }`}
                          >
                            {isX ? 'X' : opt}
                          </div>
                        )
                      })}
                        <span className="inline sm:hidden">{m.short_name_away}</span>
                        <span className="hidden sm:inline">{m.away_team}</span>
                      <div className="flex justify-center">
                        {bonusEntry ? (
                          bonusCode === 'RIBERY' ? (
                            (m.id === matchWin || m.id === matchZero) ? (
                              <Image
                                src={bonusLogos['RIBERY']}
                                alt="RIBERY bonus"
                                width={32}
                                height={32}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-6 h-6 bg-blue-500 rounded-full" />
                            )
                          ) : m.id === bonusEntry.match_id ? (
                            <Image
                              src={bonusLogos[bonusCode!]}
                              alt={`${bonusCode} bonus`}
                              width={32}
                              height={32}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 bg-blue-500 rounded-full" />
                          )
                        ) : (
                          <div className="w-6 h-6 bg-blue-500 rounded-full" />
                        )}
                      </div>

                      {/* LIGNE 2 */}
                      {(() => {
                        const { label, color } = getMatchLabelAndColor(m.status ?? '');
                        return (
                          <div className={`text-center text-xs ${color}`}>
                            {label}
                          </div>
                        );
                      })()}
                      <div className="text-center font-semibold">
                        {m.score_home != null ? m.score_home : '–'}
                      </div>
                      <div className="text-center text-xs">
                        {m.base_1_points ?? '-'}
                      </div>
                      <div className="text-center text-xs">
                        {m.base_n_points ?? '-'}
                      </div>
                      <div className="text-center text-xs">
                        {m.base_2_points ?? '-'}
                      </div>
                      <div className="text-center font-semibold">
                        {m.score_away != null ? m.score_away : '–'}
                      </div>
                      <div className="text-center text-sm">
                        {m.score_home != null ? `${m.points || 0} pts` : '–'}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* ── BONUS ── */}
        <div className="w-full lg:w-1/3">
          <div className="border rounded-lg p-4 space-y-4">
            {/* En-tête */}
            <div className="font-medium">
              {gridBonuses.length > 0
                ? `Tu as déjà joué 1 bonus :`
                : `Joue 1 des ${bonusDefs.length} bonus :`}
            </div>

            {/* Liste des defs */}
            {bonusDefs.map(b => {
              const isPlayed = gridBonuses.some(
                gb => gb.bonus_definition === b.id
              )
              const hasPlayedAny = gridBonuses.length > 0

              return (
                <div
                  key={b.id}
                  className="border rounded-lg p-3 bg-blue-50 flex items-center justify-between"
                >
                  {/* Icône + libellé */}
                  <div className="flex items-center">
                    <Image
                      src={bonusLogos[b.code]}
                      alt={b.code}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                    <div className="ml-3">
                      <div className="text-lg font-bold text-green-600">
                        {b.code}
                      </div>
                      <div className="text-sm">{b.description}</div>
                    </div>
                  </div>

                  {/* Bouton : si aucun bonus joué → JOUER ; si c'est celui-ci joué → MODIFIER */}
                  <div>
                    {!hasPlayedAny && (
                      <button
                        onClick={() => setOpenedBonus(b)}
                        className="px-3 py-1 border rounded hover:bg-gray-100"
                      >
                        JOUER
                      </button>
                    )}
                    {isPlayed && (() => {
                      const bonusEntry = gridBonuses.find(gb => gb.bonus_definition === b.id);
                      const bonusMatch = matches.find(m => m.id === bonusEntry?.match_id);
                      const bonusIsLocked = bonusEntry && bonusMatch?.status?.toUpperCase?.() !== 'NS';

                      if (bonusIsLocked) {
                        return (
                          <div className="px-3 py-1 border rounded text-gray-500 flex items-center gap-2 cursor-not-allowed">
                            <span>🔒</span>
                            <span>EN JEU</span>
                          </div>
                        );
                      }

                      return (
                        <button
                          onClick={() => setOpenedBonus(b)}
                          className="px-3 py-1 border rounded hover:bg-gray-100"
                        >
                          MODIFIER
                        </button>
                      );
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        </div>


        {/* ── POPUP BONUS ── */}
        {openedBonus && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 w-80 relative">
              <button
                onClick={() => setOpenedBonus(null)}
                className="absolute top-2 right-2 text-black text-xl"
              >
                ✕
              </button>
              <h2 className="text-2xl font-bold mb-2">
                {openedBonus.code}
              </h2>
              <p className="mb-4">
                {openedBonus.description}
              </p>

              {/* Contenu selon bonus */}
              {openedBonus.code === 'RIBERY' ? (
                <>
                  <label className="block mb-3">
                    Match à 3 croix
                    <select
                      value={popupMatch1}
                      onChange={(e) =>
                        setPopupMatch1(e.target.value)
                      }
                      className="mt-1 block w-full border rounded p-2"
                    >
                      <option value="">
                        — Choisir match —
                      </option>
                      {matches.filter(m => m.status?.toUpperCase?.() === 'NS' && !m.is_locked).map((m) => (
                        <option
                          key={m.id}
                          value={String(m.id)}
                        >
                          {m.home_team} vs {m.away_team} – {m.base_1_points}/{m.base_n_points}/{m.base_2_points}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block mb-6">
                    Match à 0 croix
                    <select
                      value={popupMatch0}
                      onChange={(e) =>
                        setPopupMatch0(e.target.value)
                      }
                      className="mt-1 block w-full border rounded p-2"
                    >
                      <option value="">
                        — Choisir match —
                      </option>
                      {matches.filter(m => m.status?.toUpperCase?.() === 'NS' && !m.is_locked).map((m) => (
                        <option
                          key={m.id}
                          value={String(m.id)}
                        >
                          {m.home_team} vs {m.away_team} – {m.base_1_points}/{m.base_n_points}/{m.base_2_points}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : openedBonus.code === 'ZLATAN' ? (
                <>
                  <label className="block mb-3">
                    Match
                      {(() => {
                      console.log("🟡 Liste matches bonus :", matches.map(m => ({
                        id: m.id,
                        status: m.status,
                        is_locked: m.is_locked
                      })));
                      return null;
                    })()}
                    <select
                      value={popupMatch1}
                      onChange={(e) =>
                        setPopupMatch1(e.target.value)
                      }
                      className="mt-1 block w-full border rounded p-2"
                    >
                      <option value="">
                        — Choisir match —
                      </option>
                      {matches.filter(m => m.status?.toUpperCase?.() === 'NS' && !m.is_locked).map((m) => (
                        <option
                          key={m.id}
                          value={String(m.id)}
                        >
                          {m.home_team} vs {m.away_team} – {m.base_1_points}/{m.base_n_points}/{m.base_2_points}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block mb-6">
                    Pronostic
                    <select
                      value={popupPick}
                      onChange={(e) => setPopupPick(e.target.value as '1' | 'N' | '2')}
                      className="mt-1 block w-full border rounded p-2"
                    >
                      <option value="1">1</option>
                      <option value="N">N</option>
                      <option value="2">2</option>
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label className="block mb-3">
                    Match
                    <select
                      value={popupMatch1}
                      onChange={(e) =>
                        setPopupMatch1(e.target.value)
                      }
                      className="mt-1 block w-full border rounded p-2"
                    >
                      <option value="">
                        — Choisir match —
                      </option>
                      {matches.filter(m => m.status?.toUpperCase?.() === 'NS' && !m.is_locked).map((m) => (
                        <option
                          key={m.id}
                          value={String(m.id)}
                        >
                          {m.home_team} vs {m.away_team} – {m.base_1_points}/{m.base_n_points}/{m.base_2_points}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block mb-6">
                    Paire de croix
                    <select
                      value={popupPair}
                      onChange={(e) => setPopupPair(e.target.value as '1-N' | 'N-2' | '1-2')}
                      className="mt-1 block w-full border rounded p-2"
                    >
                      <option value="1-N">1 N</option>
                      <option value="N-2">N 2</option>
                      <option value="1-2">2 1</option>
                    </select>
                  </label>
                </>
              )}
              <div className="flex justify-between">
                {gridBonuses.some(
                  (b) => b.bonus_definition === openedBonus.id
                ) && (
                  <button
                    onClick={handleBonusDelete}
                    className="px-4 py-2 bg-red-500 text-white rounded"
                  >
                    Supprimer
                  </button>
                )}
                <button
                  onClick={handleBonusValidate}
                  className="px-4 py-2 bg-green-500 text-white rounded"
                >
                  Valider
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
    </>
  );
}
