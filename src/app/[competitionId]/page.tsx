'use client';

type BonusParameters =
  | { picks: string[] }         // Kanté
  | { match_win: string; match_zero: string } // Ribéry
  | { pick: string };           // Zlatan

type LeaderboardRow = {
  user_id: string;
  username: string;
  total_points: number;
  rank: number;
};

type MatchPickRow = {
  user_id: string;
  username: string;
  pick_1: boolean;
  pick_n: boolean;
  pick_2: boolean;
  has_bonus: boolean;
  bonus_code: string | null;
};

type PopupMatch = {
  id: string;
  home: string;
  away: string;
  base1: number | null;
  baseN: number | null;
  base2: number | null;
};

import type { User } from '@supabase/supabase-js';
import type { Grid, Match, GridBonus, BonusDef, GridWithItems, MatchWithState, RawMatchRow } from '../../lib/types';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useSupabase } from '../../components/SupabaseProvider'
import { useRouter, useSearchParams, useParams} from 'next/navigation';
import { usePlayerGate } from '../../hooks/usePlayerGate';
import supabase from '../../lib/supabaseBrowser';

const bonusLogos: Record<string,string> = {
  "KANTE": '/images/kante.png',
  "RIBERY": '/images/ribery.png',
  "ZLATAN": '/images/zlatan.png',
  "BIELSA" : '/images/bonus/bielsa.png',
  "INFO" : '/images/info.png',  
};

const ELIM_IMAGES: Record<string, string> = {
  shark: '/images/elimine/shark.png',
  totem: '/images/elimine/totem.png',
  terminator: '/images/elimine/terminator.png',
  spectateur: '/images/elimine/spectateur.png',
  default: '/images/elimine/default.png',
};

export default function HomePage() {

  //pour les classements
  const [lbRows, setLbRows] = useState<LeaderboardRow[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);

  const supabase = useSupabase()
  // 👉 État principal de l'utilisateur connecté (renseigné au chargement)
  const [user, setUser] = useState<User | null>(null);
  // 👉 Liste complète des grilles du joueur
  const [grids, setGrids] = useState<GridWithItems[]>([]);
  // 👉 Grille actuellement sélectionnée (par index ou en navigation)
  const [grid, setGrid] = useState<GridWithItems | null>(null);
  // 👉 Liste des matchs de la grille active
  const [matches, setMatches] = useState<(MatchWithState & { grid_id?: string | number })[]>([]);
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
  type View = 'grid' | 'rankGrid' | 'rankGeneral';

  const viewParam = (searchParams?.get('view') as View) || 'grid';
  const [view, setView] = useState<View>(viewParam);

  const setViewAndURL = (v: View) => {
    setView(v);
    const params = new URLSearchParams(Array.from(searchParams?.entries?.() ?? []));
    params.set('view', v);
    router.replace(`/${competitionId}?${params.toString()}`);
  };

  const pageParam = searchParams?.get('page');
  const initialPage = pageParam ? Number(pageParam) : 0;
  const [currentIdx, setCurrentIdx] = useState(initialPage);
  // Pour la navigation générale
  const hasRun = useRef(false);
  const [error, setError]           = useState<string|null>(null);
  const router        = useRouter();
  const params = useParams();
  const competitionId = params?.competitionId as string;
  const [competition, setCompetition] = useState<{ id: string; name: string; mode: string } | null>(null);
  const [competitionReady, setCompetitionReady] = useState(false);
  console.log("🔍 competitionId reçu :", competitionId);

  //pour afficher zones GRILLES/BONUS suivant le mode CLASSIC/TOURNOI
  // 1) Charger name + mode depuis la table competitions
useEffect(() => {
  if (!competitionId) return;
  console.time('[competitions] fetch');
  console.log('[competitions] start', competitionId);

  (async () => {
    const { data, error } = await supabase
      .from('competitions')
      .select('id,name,mode')
      .eq('id', competitionId)
      .maybeSingle();

    if (error) {
      console.warn('[competitions] ERROR', error.message);
      setCompetition(null);
    } else if (!data) {
      console.log('[competitions] NOT_FOUND');
      setCompetition(null);
    } else {
      console.log('[competitions] OK', { id: data.id, mode: data.mode });
      setCompetition(data);
      console.log('[competitions] fetched', {
  id: data?.id,
  name: data?.name,
  rawMode: `‹${data?.mode}›`
});
    }
    setCompetitionReady(true);
    console.timeEnd('[competitions] fetch');
  })();
  // dep: seulement competitionId (l'instance supabase est stable)
}, [competitionId]);


  const [showOffside, setShowOffside] = useState(false);
  const pathname = '/' + competitionId;
  // 👉 Change l’index ET met à jour l’URL en shallow routing
const goToPage = (i: number) => {
  setCurrentIdx(i);
  const params = new URLSearchParams(Array.from(searchParams?.entries?.() ?? []));
  params.set('page', String(i));
  params.set('view', view); // ✅ garder la vue active
  router.replace(`/${competitionId}?${params.toString()}`);
};

  // 👉 Fonctions de navigation
  const prevGrid = () => {
    if (currentIdx > 0) goToPage(currentIdx - 1); // ← vers grille précédente
  };

  const nextGrid = () => {
    if (currentIdx < grids.length - 1) goToPage(currentIdx + 1); // → vers grille suivante
  };

  const [lastMatchData, setLastMatchData] = useState<RawMatchRow[]>([]);

  const [showPopup, setShowPopup] = useState(false);
  const [popupMatchStatus, setPopupMatchStatus] = useState<'NS' | 'OTHER' | null>(null);
  const [popupMatch, setPopupMatch] = useState<PopupMatch | null>(null);
  const [otherPicks, setOtherPicks] = useState<any[]>([]);
  // 👉 Pour les tris du pop-up pronos des autres
  const [sortMode, setSortMode] = useState<'rank' | 'alpha'>('rank');

  // prend la grille sélectionnée, sinon celle pointée par l’index d’URL, sinon la première
  const currentGrid: GridWithItems | null = grid ?? grids[currentIdx] ?? grids[0] ?? null;

  // et pour l’affichage:
  const title = currentGrid?.title ?? '';
  const description = currentGrid?.description ?? '';

  // 1) IDs pour le "gate"
  const userId = user?.id ?? null;
  const gridId = currentGrid?.id ? String(currentGrid.id) : null;

  // 2) Déduire le mode + variante image
const modeRaw = String(competition?.mode ?? '');
const mode: 'CLASSIC' | 'TOURNOI' = modeRaw.trim().toUpperCase() === 'TOURNOI' ? 'TOURNOI' : 'CLASSIC';
console.log('[mode]', { raw: `‹${modeRaw}›`, normalized: mode });
console.log('[mode-check]', {
  routeId: competitionId,
  compId: competition?.id,
  raw: `‹${modeRaw}›`,
  normalized: mode
});

  const elimVariant = getElimVariant(competition?.name ?? '');

  // 6) Gate
  const gate = usePlayerGate(userId, competitionId, gridId || '', mode);
  console.log('[gate] state=', gate.state, 'reason=', gate.reason);

  let early: null | string = null;
  if (!competitionReady) early = 'COMPET_LOADING';
  else if (loadingGrids && grids.length === 0) early = 'GRIDS_LOADING';
  else if (!gridId) early = 'NO_GRID';
  else if (gate.state === 'loading') early = 'GATE_LOADING';

  console.log('[early]', { early, loadingGrids, gridsLen: grids.length, gridId, gate: gate.state });

// après chargement complet, déterminer l’affichage
if (!loadingGrids && grids.length === 0) {
  return <div className="p-6 text-center">Aucune grille disponible pour cette compétition.</div>;
}
if (!loadingGrids && grids.length > 0 && !gridId) {
  console.log('[page] no gridId yet but grids loaded, waiting index selection…');
  return <div>Initialisation de la grille…</div>;
}

  // joueur ? sinon tout devient lecture seule
  const isReadOnly = gate.state !== 'joueur';

  console.log('[gate] mode=', mode, 'comp=', competition?.id, 'gridId=', gridId);
  console.log('[gate] grids loaded?', !loadingGrids, 'count=', grids.length, 'currentIdx=', currentIdx);
  console.log('[gate] userId=', userId);

  // 👉 Format FR pour la date
  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('fr-FR',{
      day:'2-digit', month:'2-digit',
      hour:'2-digit', minute:'2-digit'
    }).replace(/\u202F/g,' ');

  // 👉 Format FR pour le status des matchs
  const getMatchLabelAndColor = (status: string) => {
    const s = status.toUpperCase();

    if (['NS', 'TBD'].includes(s)) return { label: 'À venir', color: 'text-blue-600' };

    if (s === '1H') return { label: '1re MT', color: 'text-orange-500' };
    if (s === 'HT') return { label: 'Mi-temps', color: 'text-orange-500' };
    if (s === '2H') return { label: '2e MT', color: 'text-orange-500' };
    if (s === 'PST') return { label: 'Reporté', color: 'text-red-600' };

    // Tous les statuts post-temps réglementaire = considéré comme terminé
    // ET=prolongations, BT=pause avant prolongations, AET=terminé après prolongations
    // P=pénaltis, AET=terminé après pénaltis. FT=full time.
    if (['ET', 'BT', 'P', 'FT', 'AET', 'PEN'].includes(s)) {
      return { label: 'Terminé', color: 'text-gray-700' };
    }

    // Match suspendu qui peut reprendre
    if (['SUSP', 'INT'].includes(s)) {
      return { label: 'Suspendu', color: 'text-orange-600' };
    }
    // Statuts d'annulation d'un match
    // CANC=annulé, ABD=abandonné, AWD=tapis vert, WO=forfait
    if (['CANC', 'ABD', 'AWD', 'WO'].includes(s)) {
      return { label: 'Annulé', color: 'text-red-600' };
    }

    // Fallback
    return { label: s, color: 'text-gray-400' };
  };

  // pour l'affichage des classements
  async function fetchGeneralLeaderboard() {
    if (!competitionId) return;
    setLbLoading(true); setLbRows([]); setMyRank(null);

    const { data, error } = await supabase.rpc('get_leaderboard_general', {
      p_competition_id: competitionId,
    });

    setLbLoading(false);
    if (error || !data) return;

    const rows = data as LeaderboardRow[];
    setLbRows(rows);
    setTotalPlayers(rows.length);
    setMyRank(rows.find(r => r.user_id === user?.id)?.rank ?? null);
  }

  async function fetchLeaderboardByGrid() {
    const gridId = grids[currentIdx]?.id;
    if (!gridId) return;

    setLbLoading(true); setLbRows([]); setMyRank(null);

    const { data, error } = await supabase.rpc('get_leaderboard_by_grid', {
      p_grid_id: gridId,
    });

    setLbLoading(false);
    if (error || !data) return;

    const rows = data as LeaderboardRow[];
    setLbRows(rows);
    setTotalPlayers(rows.length);
    setMyRank(rows.find(r => r.user_id === user?.id)?.rank ?? null);
  }

  // pour afficher l'image éliminé dans le mode TOURNOI
  function getElimVariant(competitionName: string) {
    const n = (competitionName || '').toLowerCase();
    if (n.includes('shark')) return 'shark';
    if (n.includes('totem')) return 'totem';
    if (n.includes('terminator')) return 'terminator';
    return 'default';
  }

  //Gestion de la view
useEffect(() => {
  if (!competitionReady) return;                  // ✅ évite le run en CLASSIC par défaut
  if (view === 'rankGeneral' && mode !== 'TOURNOI') fetchGeneralLeaderboard();
  if (view === 'rankGrid')                          fetchLeaderboardByGrid();
  console.log('[rank] effect run', { view, mode });
}, [view, competitionId, currentIdx, grids, mode, competitionReady]);

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
const LIVE_CODES = new Set(['1H', 'HT', '2H']);

function normStatus(s?: string) {
  return String(s ?? '').trim().toUpperCase();
}

useEffect(() => {
  if (grids.length === 0 || matches.length === 0) return;

  const nowTs = Date.now();
  const matchById = new Map(matches.map(m => [m.id, m])); // id = uuid

  const hasLiveInGrid = (grid: GridWithItems) =>
    Array.isArray(grid.grid_items) &&
    grid.grid_items.some(item => {
      const m = matchById.get(item.match_id); // match_id = uuid
      return m && LIVE_CODES.has(normStatus(m.status));
    });

  const hasNextNSInGrid = (grid: GridWithItems) =>
    Array.isArray(grid.grid_items) &&
    grid.grid_items.some(item => {
      const m = matchById.get(item.match_id);
      if (!m || normStatus(m.status) !== 'NS') return false;
      const t = Date.parse(m.date);
      return Number.isFinite(t) && t > nowTs;
    });

  // --- DIAGNOSTIC COURT ---
  // Combien d'items de grilles pointent vers un match effectivement présent dans `matches` ?
  const allItems = (grids as GridWithItems[]).flatMap(g => g.grid_items ?? []);
  const covered = allItems.filter(it => matchById.has(it.match_id)).length;
  if (covered === 0) {
    console.log('⚠️ Aucun grid_item ne matche un match présent dans `matches` à cet instant.');
    return; // surtout ne pas forcer idx=0
  }
  // -------------------------

  // 1) priorité aux grilles avec un match live
  const liveIdx = (grids as GridWithItems[]).findIndex(hasLiveInGrid);
  if (liveIdx >= 0) {
    setCurrentIdx(liveIdx);
    return;
  }

  // 2) sinon première grille avec un match NS à venir
  const nsIdx = (grids as GridWithItems[]).findIndex(hasNextNSInGrid);
  if (nsIdx >= 0) {
    setCurrentIdx(nsIdx);
    return;
  }

  // 3) rien trouvé → ne change pas l’index courant (évite le retour à 0)
  console.log('ℹ️ Pas de live ni de NS futur détecté pour les grilles couvertes.');
}, [grids, matches]);



  // 🔁 Au premier chargement : on récupère l'utilisateur connecté et ses grilles
useEffect(() => {
  console.log('[init] guard', { competitionId, hasRun: hasRun.current });
  if (!competitionId) return;
  if (hasRun.current) return;

  hasRun.current = true;

  (async () => {
    console.log('[init] start');
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user ?? null);

    // 🔴 Ne PAS appeler loadUserGrids si on n'a pas encore d'user
    if (!user) {
      console.log('[init] no user yet → skip loadUserGrids to avoid user_id=__PUBLIC__');
      return;
    }

    console.log('[init] call loadUserGrids');
    await loadUserGrids(user.id, competitionId);
  })();
}, [competitionId]);

  // 📦 Charge toutes les grilles et matchs d’un joueur, LIMITÉ à la compétition active
async function loadUserGrids(userId: string, competitionId: string, initialIdx?: number) {
  console.log('[lug] start', { userId, competitionId });
  let finalGrids: { grid: GridWithItems; matches: MatchWithState[] }[] = [];
  try {
    setLoadingGrids(true);
    console.log('[lug] fetch competition_grids…');

    // 0) IDs des grilles de la compétition
    const { data: cgIds, error: cgErr } = await supabase
      .from('competition_grids')
      .select('grid_id')
      .eq('competition_id', competitionId);
      console.log('[lug] competition_grids =>', { len: cgIds?.length, err: !!cgErr, cgErr });

    if (cgErr || !cgIds?.length) {
      setError("Aucune grille pour cette compétition.");
      return; // le finally remettra loadingGrids=false
    }
    const gridIds = cgIds.map(g => g.grid_id);
    console.log('[lug] fetch grids meta…');

    // 0bis) Récupère TOUJOURS les métadonnées des grilles (pour afficher même sans pick)
    const { data: gridMeta, error: gridErr } = await supabase
      .from('grids')
      .select('id, title, description, allowed_bonuses, grid_items(match_id)')
      .in('id', gridIds);
      console.log('[lug] grids meta =>', { len: gridMeta?.length, err: !!gridErr, gridErr });
    if (gridErr) {
      setError("Erreur chargement des grilles.");
      return;
    }
    console.log('[lug] fetch grid_matches…');

    // 1) grid_matches du joueur (peut être vide si pas encore joué)
    const { data: matchData, error: matchError } = await supabase
      .from("grid_matches")
      .select(`
        grid_id,
        match_id,
        pick,
        points,
        matches (
          id, date, home_team, away_team, fixture_id, league_id,
          base_1_points, base_n_points, base_2_points,
          score_home, score_away, status, is_locked,
          odd_1_snapshot, odd_n_snapshot, odd_2_snapshot,
          short_name_home, short_name_away
        ),
        grids ( id, title, description, allowed_bonuses, grid_items(match_id) )
      `)
      .eq("user_id", userId)
      .in("grid_id", gridIds);
      console.log('[lug] grid_matches =>', { len: matchData?.length, err: !!matchError, matchError });

    if (matchError) {
      setError("Erreur chargement grilles.");
      return;
    }

    setLastMatchData(matchData as RawMatchRow[]);

    // 2) Regrouper par grille si on a des picks
    if (matchData && matchData.length > 0) {
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

      finalGrids = Object.values(groupedByGrid)
        .map(({ grid, matches }) => ({
          grid: { ...grid, grid_items: (grid as any).grid_items ?? [] } as GridWithItems,
          matches
        }))
        .sort((a, b) => a.grid.title.localeCompare(b.grid.title, 'fr', { numeric: true, sensitivity: 'base' }));

      // matches de la première grille triés par date
      const firstGridId = finalGrids[0]?.grid.id;
      const firstMatches = (Object
        .values(groupedByGrid)
        .find(({ grid }) => grid.id === firstGridId)?.matches ?? [])
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setGrids(finalGrids.map(f => f.grid));
      setMatches(firstMatches);
    } else {
      const cleanGrids: GridWithItems[] = (gridMeta ?? [])
        .map(g => ({
          id: g.id,
          title: g.title,
          description: g.description,
          allowed_bonuses: g.allowed_bonuses ?? [],
          grid_items: [],              // ✅ ajoute ce champ pour satisfaire GridWithItems
        }))
        .sort((a, b) => a.title.localeCompare(b.title, 'fr', { numeric: true, sensitivity: 'base' }));

      setGrids(cleanGrids);
      setMatches([]); // pas de picks ⇒ pas de matches enrichis
      finalGrids = cleanGrids.map(g => ({ grid: g, matches: [] }));
    }

  } catch (e) {
    console.error('[lug] error', e);
    setError("Erreur lors du chargement des grilles");
  } finally {
    // ✅ Toujours arrêter le spinner AVANT la navigation
    console.log('[lug] finally: setLoadingGrids(false)');
    setLoadingGrids(false);

    // Sélection de la grille (sans page -1)
    try {
      let chosenIdx: number | null = null;

      if (typeof initialIdx === 'number') {
        chosenIdx = initialIdx;
      } else if (finalGrids.length > 0) {
        const now = new Date();
        const idx = finalGrids.findIndex(({ matches }) =>
          matches.some(m => m.status === 'NS' && new Date(m.date) > now)
        );
        chosenIdx = (idx === -1) ? 0 : idx; // ← fallback à 0, pas -1
      }

      if (chosenIdx !== null && chosenIdx !== currentIdx) {
        goToPage(chosenIdx);
      }
    } catch (e) {
      console.warn('[loadUserGrids] page selection skipped:', e);
    }
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

        // 2) Préparer la liste des match_id à récupérer
        const ids = (g.grid_items || []).map((x: { match_id: string }) => x.match_id);

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
            base_2_points,
            short_name_home,
            short_name_away
          `)
          .in('id', ids)
          .order('date', { ascending: true });
        if (re) throw re;

        // 4) Fetch des picks posés dans grid_matches
        const { data: rawGridMatches, error: gmError } = await supabase
          .from('grid_matches')
          .select('id, match_id, pick, points')
          .eq('grid_id', gridId);
        if (gmError) throw gmError;

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

        const totalPoints = clean.reduce((acc, m) => acc + (m.points || 0), 0);
        setMatches(clean);
        setTotalPoints(totalPoints);

        // 6) Fetch des bonus déjà joués pour cette grille
        const { data: gbs, error: gbe } = await supabase
          .from('grid_bonus')
          .select('id, grid_id, user_id, bonus_definition, match_id, parameters')
          .eq('grid_id', gridId);
        if (gbe) throw gbe;
        setGridBonuses(gbs || []);

        // 7) Fetch des définitions de bonus
        const { data: bd, error: be } = await supabase
          .from('bonus_definition')
          .select('id, code, description');
        if (be) throw be;
        setBonusDefs(bd || []);

      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoadingGrid(false);
      }
    })();
  }, [currentIdx, grids]);

  function getStatus(m: any) {
    const raw = m?.status ?? m?.status_short ?? m?.statusShort ?? m?.state ?? '';
    return String(raw).trim().toUpperCase();
  }
  function isLive(m: any) {
    return LIVE_CODES.has(getStatus(m));
  }
  function getTime(m: any) {
    const d = m?.date ?? m?.kickoff ?? m?.utc_date ?? null;
    const t = d ? Date.parse(d) : NaN;
    return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
  }

  // 1) Scroll/affiche TOUJOURS la grille du match en cours (priorité à la grid_id mémorisée)
  useEffect(() => {
    if (!matches?.length) return;

    const liveMatches = [...matches].filter(isLive).sort((a, b) => getTime(a) - getTime(b));

    // si on a mémorisé une grid_id au précédent refresh, on la privilégie
    const stored = sessionStorage.getItem('focusGridId');
    let target = stored
      ? liveMatches.find(m => String(m.grid_id) === stored) ?? null
      : null;

    // sinon, on prend le premier live (le plus proche temporellement)
    if (!target) target = liveMatches[0] ?? null;

    if (target?.grid_id) {
      // on remet à jour la mémoire pour rester cohérent aux prochains refresh
      sessionStorage.setItem('focusGridId', String(target.grid_id));
      document.getElementById(`grid-${target.grid_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [matches]);

  // 2) Auto-refresh toutes les 30s UNIQUEMENT s’il y a du live
  useEffect(() => {
    const liveNow = matches?.filter(isLive).sort((a, b) => getTime(a) - getTime(b)) ?? [];
    if (liveNow.length === 0) return;

    const interval = setInterval(() => {
      // avant de recharger, on mémorise la grid du match live prioritaire
      const current = liveNow[0];
      if (current?.grid_id) {
        sessionStorage.setItem('focusGridId', String(current.grid_id));
      }
      window.location.reload();
    }, 120_000); // 120s

    return () => clearInterval(interval);
  }, [matches]);


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

    const match = matches.find(m => m.id === match_id);
    if (!match) return;
    console.log('[pick] click', { mode, gridId: grid.id, match_id, pick, beforeLen: matches.length });

    const matchTime = new Date(match.date).getTime(); //début du match
    const now = Date.now();
    const margin = 60 * 1000; // 1 minute

    console.log('🕒 Test horaire :', {
      match_id: match.id,
      kickoff: (match as any).utc_date,
      now: new Date(),
      parsed: new Date((match as any).utc_date).getTime(),
    });

    if (now >= matchTime - margin) {
      setShowOffside(true);
      return;
    }

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
    console.log('[pick] saved ok', { gridId: grid.id, match_id });
    setMatches(updatedMatches);
    
const activeGrid = grids.find((g) => g.id === grid.id);
if (activeGrid && activeGrid.grid_items) {
  const matchIds = activeGrid.grid_items.map((gi) => gi.match_id);

  // LOG court
  console.log('[pick] refresh src', { lastLen: lastMatchData.length, ids: matchIds.length });

  const refreshedMatches = lastMatchData
    .filter((row) => matchIds.includes(row.match_id))
    .map((row) => ({
      ...(row.matches as Match),
      pick: row.pick ?? undefined,
      points: row.points ?? 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  console.log('[pick] refresh built', refreshedMatches.length);

  // ✅ ne pas écraser si vide
  if (refreshedMatches.length > 0) {
    setMatches(refreshedMatches);
  } else {
    console.warn('[pick] refresh skipped (empty) — keep optimistic state');
  }
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

console.log('📦 Payload préparé pour upsert', payload);

const bonusExistant = gridBonuses.find(b => b.bonus_definition === openedBonus.id);
if (bonusExistant) {
  const margin = 60 * 1000;
  let matchIdsToCheck: string[] = [];

  if (
    openedBonus.code === 'RIBERY' &&
    'match_win' in bonusExistant.parameters &&
    'match_zero' in bonusExistant.parameters
  ) {
    matchIdsToCheck = [
      bonusExistant.parameters.match_win,
      bonusExistant.parameters.match_zero
    ];
  } else {
    matchIdsToCheck = [bonusExistant.match_id];
  }

  for (const matchId of matchIdsToCheck) {
    const m = matches.find(m => m.id === matchId);
    if (!m || !('date' in m)) continue;

    const matchTime = new Date(m.date).getTime();
    const now = Date.now();

    if (now > matchTime - margin) {
      console.log('🚫 Bonus déjà validé et un des matchs est commencé → modification interdite', matchId);
      setShowOffside(true);
      return;
    }
  }
}


      // 3) Vérifie si le match concerné par le bonus est déjà commencé
const matchesToCheck =
  openedBonus.code === 'RIBERY' ? [popupMatch1, popupMatch0] :
  openedBonus.code === 'ZLATAN' ? [popupMatch1] :
  openedBonus.code === 'KANTE' ? [popupMatch1] :
  openedBonus.code === 'BIELSA'  ? [popupMatch1] :
  [];

if (matchesToCheck.length === 0 || matchesToCheck.includes('')) {
  console.log('⛔ Match manquant pour la vérification du bonus', openedBonus.code);
  return;
}

for (const matchId of matchesToCheck) {
  const m = matches.find(m => m.id === matchId);
  if (!m || !('date' in m)) return;

  const matchTime = new Date(m.date).getTime();
  const now = Date.now();
  const margin = 60 * 1000;

  console.log('⏱ Vérification Ribéry :', {
    match_id: matchId,
    kickoff: m.date,
    now: new Date(),
    parsed: matchTime
  });

  if (now > matchTime - margin) {
    console.log('⛔ Match trop tardif détecté : ', matchId, new Date(m.date));
    setShowOffside(true);
    console.log('✅ Match encore valide : ', matchId);
    return;
  }
}

      // 4) Logique spécifique à chaque bonus
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

        case 'BIELSA': {
          if (!popupMatch1) return alert('Match requis pour Bielsa');
          payload.match_id = popupMatch1;        // ← explicite, comme ZLATAN
          payload.parameters = { pick: popupPick }; // '1' | 'N' | '2'
          break;
        }

        default:
          return alert('Bonus non reconnu : ' + openedBonus.code);
      }

      // 5) Envoi Supabase
      const { data, error: be } = await supabase
        .from('grid_bonus')
        .upsert([payload], {
          onConflict: 'user_id,grid_id'
        });

      // 6) Recharge les bonus pour la grille actuelle
      const { data: gbs, error: gbe } = await supabase
        .from('grid_bonus')
        .select('id, grid_id, user_id, bonus_definition, match_id, parameters')
        .eq('grid_id', grid.id);
      console.log('🧾 Résultat upsert Supabase :', { data, error: be });

      if (gbe) throw gbe;

      setGridBonuses(gbs || []);

      if (be) throw be;

      // 7) Update local
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

      // 8) Fermeture du popup
      setOpenedBonus(null);
      setPopupMatch1('');
      setPopupMatch0('');
    }
    catch (e: unknown) {
      alert('Erreur Supabase : ' + (e instanceof Error ? e.message : String(e)));
    }
  };
   
  // 🧨 Suppression d’un bonus (base + front + points)
  const handleBonusDelete = async () => {
    if (!openedBonus || !user) return;

    // 🔍 Récupère le bonus posé pour cette grille
    const placedBonus = gridBonuses.find(b => b.bonus_definition === openedBonus.id);
    if (!placedBonus) return;

    const margin = 60 * 1000;
    let matchIdsToCheck: string[] = [];

    // 🧠 Cas particulier RIBERY
    if (
      openedBonus.code === 'RIBERY' &&
      'match_win' in placedBonus.parameters &&
      'match_zero' in placedBonus.parameters
    ) {
      matchIdsToCheck = [
        placedBonus.parameters.match_win,
        placedBonus.parameters.match_zero
      ];
    } else {
      matchIdsToCheck = [placedBonus.match_id];
    }

    // 🔎 Vérifie l'heure de tous les matchs concernés
    for (const matchId of matchIdsToCheck) {
      const m = matches.find(m => m.id === matchId);
      if (!m || !('date' in m)) continue;

      const matchTime = new Date(m.date).getTime();
      const now = Date.now();

      console.log('⏱ Test horaire dans handleBonusDelete :', {
        bonus: openedBonus.code,
        match_id: matchId,
        kickoff: m.date,
        now: new Date(),
        parsed: matchTime
      });

      if (now > matchTime - margin) {
        setShowOffside(true);
        console.log('🚫 pop-up OFFSIDE déclenché (delete bonus) !');
        return;
      }
    }

    try {
      // 1) Supprimer côté base
      const { error: de } = await supabase
        .from('grid_bonus')
        .delete()
        .eq('user_id', user.id)
        .eq('grid_id', grid.id)
        .eq('bonus_definition', openedBonus.id);

      if (de) throw de;

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
      alert('Erreur suppression bonus : ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  // // 🧠 Aide bonus : savoir si un bonus a été joué, et lequel
  const isPlayed = gridBonuses.length>0;
  const playedBonusCode = bonusDefs.find(b=>b.id===gridBonuses[0]?.bonus_definition)?.code;
  // pour savoir quel bonus affiché dans la zone bonus
const allowedIds = (grid?.allowed_bonuses ?? null) as string[] | null;

const visibleBonusDefs =
  allowedIds === null
    ? null                               // => "Pas de bonus pour cette grille"
    : bonusDefs.filter(b => allowedIds.includes(b.id));

const noBonusForThisGrid = visibleBonusDefs === null;

// BIELSA déjà posé ?
const bielsaMatchId =
  gridBonuses.find(gb => bonusDefs.find(d => d.id === gb.bonus_definition)?.code === 'BIELSA')
    ?.match_id ?? null;

// Y a-t-il au moins 1 match non-NS qui a déjà une croix ?
const hasStartedPickedMatch = matches.some(m =>
  !!m.pick && (m.status?.toUpperCase?.() !== 'NS')
);

// Début du JSX
return early ? (
  <div>Chargement… ({early})</div>
) : (
      <>
    <main className="w-full px-2 sm:px-4 py-8">
      {/* 1) ZONE D’INFORMATION PLEIN LARGEUR */}
        {/* Bandeau info : desktop = 1 ligne / mobile = 2 lignes */}
        <section className="w-full mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* A) NAVIGATION GRILLES */}
            <div className="border rounded-lg p-4 flex items-center justify-center gap-4">
              {/* ← Précédent */}
              <button
                onClick={prevGrid}
                disabled={currentIdx === 0}
                className="bg-[#212121] hover:bg-gray-800 text-white rounded-full p-2 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Grille précédente"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <span className="text-2xl font-semibold">
                {currentGrid?.title || "Chargement..."}
              </span>

              {/* → Suivante */}
              <button
                onClick={nextGrid}
                disabled={currentIdx === grids.length - 1}
                className="bg-[#212121] hover:bg-gray-800 text-white rounded-full p-2 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Grille suivante"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* B) 1N2 • POINTS • PODIUM • STATS */}
            <div className="border rounded-lg p-4 flex items-center justify-center gap-4">
              {/* 1) Aller à la GRILLE */}
              <button
                onClick={() => setViewAndURL('grid')}
                aria-pressed={view==='grid'}
                className={`w-12 h-12 rounded-full border border-black bg-white p-[3px]
                            flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none
                            ${view==='grid' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
                title="Voir la grille"
              >
  <Image
    src="/images/icons/grille.png"   // ton PNG (sans cercle noir)
    alt="Grille"
    width={40}
    height={40}
    className="rounded-full object-cover"
  />
              </button>

              {/* 2) POINTS (non cliquable) */}
              <div
                className="w-12 h-12 rounded-full border flex items-center justify-center text-base font-semibold select-none"
                title="Points de la grille sélectionnée"
                aria-label="Points"
              >
                {totalPoints}
              </div>

              {/* 3) Classement GÉNÉRAL */}
              {mode === 'CLASSIC' && (
              <button
                onClick={() => setViewAndURL('rankGeneral')}
                aria-pressed={view==='rankGeneral'}
                className={`w-12 h-12 rounded-full border border-black bg-white p-[3px]
                            flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none
                            ${view==='rankGeneral' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
                title="Classement général"
              >
              <Image
                src="/images/icons/podium.png"   // ton PNG (sans cercle noir)
                alt="Podium"
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
              </button>
              )}

              {/* 4) Classement de la GRILLE */}
              <button
                onClick={() => setViewAndURL('rankGrid')}
                aria-pressed={view==='rankGrid'}
                className={`w-12 h-12 rounded-full border border-black bg-white p-[3px]
                            flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none
                            ${view==='rankGrid' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
                title="Classement de la grille"
              >
  <Image
    src="/images/icons/classement.png"   // ton PNG (sans cercle noir)
    alt="Classement"
    width={40}
    height={40}
    className="rounded-full object-cover"
  />
              </button>
            </div>

            {/* C) DESCRIPTION (texte seul) */}
            {Boolean(currentGrid?.description?.trim()) && (
              <div className="border rounded-lg p-4 flex items-center justify-center md:col-span-2">
                <p className="text-center whitespace-pre-line">
                  {currentGrid!.description}
                </p>
              </div>
            )}

          </div>
        </section>

      {/* Vue des 2 classements */}
      {view === 'rankGrid' && (
        <div className="w-full">
          {lbLoading && <p className="text-center text-sm text-gray-500 my-4">Chargement…</p>}
            <h2 className="text-center text-lg font-semibold text-gray-800 mb-3">
              Classement de la grille
            </h2>
          {!lbLoading && myRank !== null && (
            <div className="text-center text-base font-medium text-gray-800 my-6">
              Tu es <strong>{myRank}</strong>
              <span className="ml-1 align-super">{myRank === 1 ? 'er' : 'e'}</span>
              {' '}sur <strong>{totalPlayers}</strong> joueur{totalPlayers > 1 ? 's' : ''}
            </div>
          )}

          {!lbLoading && lbRows.length > 0 && (
            <div className="max-w-2xl mx-auto">
              <table className="w-full bg-white shadow rounded-lg overflow-hidden text-sm">
                <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="text-left px-4 py-3">Position</th>
                    <th className="text-left px-4 py-3">Pseudo</th>
                    <th className="text-left px-4 py-3">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {lbRows.map(row => {
                    const me = row.user_id === user?.id;
                    return (
                      <tr key={row.user_id}
                          className={`border-t transition ${me ? 'bg-orange-100 font-bold' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-2">{row.rank}</td>
                        <td className="px-4 py-2">{row.username}</td>
                        <td className="px-4 py-2">{row.total_points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!lbLoading && lbRows.length === 0 && (
            <p className="text-center text-sm text-gray-500 my-4">Aucun participant pour cette grille.</p>
          )}
        </div>
      )}

      {mode === 'CLASSIC' && view === 'rankGeneral' && (
        <div className="w-full">
          {lbLoading && <p className="text-center text-sm text-gray-500 my-4">Chargement…</p>}
              <h2 className="text-center text-lg font-semibold text-gray-800 mb-3">
                Classement GÉNÉRAL
              </h2>
          {!lbLoading && myRank !== null && (
            <div className="text-center text-base font-medium text-gray-800 my-6">
              Tu es <strong>{myRank}</strong>
              <span className="ml-1 align-super">{myRank === 1 ? 'er' : 'e'}</span>
              {' '}sur <strong>{totalPlayers}</strong> joueur{totalPlayers > 1 ? 's' : ''}
            </div>
          )}
          {/* même tableau que ci-dessus, on réutilise lbRows */}
          {!lbLoading && lbRows.length > 0 && (
            <div className="max-w-2xl mx-auto">
              <table className="w-full bg-white shadow rounded-lg overflow-hidden text-sm">
                <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="text-left px-4 py-3">Position</th>
                    <th className="text-left px-4 py-3">Pseudo</th>
                    <th className="text-left px-4 py-3">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {lbRows.map(row => {
                    const me = row.user_id === user?.id;
                    return (
                      <tr key={row.user_id}
                          className={`border-t transition ${me ? 'bg-orange-100 font-bold' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-2">{row.rank}</td>
                        <td className="px-4 py-2">{row.username}</td>
                        <td className="px-4 py-2">{row.total_points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!lbLoading && lbRows.length === 0 && (
            <p className="text-center text-sm text-gray-500 my-4">Aucun participant pour cette compétition.</p>
          )}
        </div>
      )}

      {/* 2) CONTENU PRINCIPAL : GRILLE (2/3) & BONUS (1/3) */}
      <div className={`flex flex-col lg:flex-row gap-6 ${view !== 'grid' ? 'hidden' : ''}`}>
        {/* ── GRILLE ── */}
        <div className="w-full lg:w-2/3">
          <div className="w-full border rounded-lg space-y-2">
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

                  // 1bis) Pour le bonus BIELSA
                  const paramsPick = (params as { pick?: '1' | 'N' | '2' }).pick;
                  const isBielsaActive = bonusCode === 'BIELSA' && !!bielsaMatchId;
                  const isMutedByBielsa = isBielsaActive && m.id !== bielsaMatchId;
                  const isBielsaThis   = isBielsaActive && m.id === bielsaMatchId;
                  const isBielsaOther  = isBielsaActive && m.id !== bielsaMatchId;

                  // 2) Prépare picks et disabled
                  let picksForThisMatch: string[] =
                    bonusEntry && bonusCode
                      ? [] // sera écrasé dans le switch bonus
                      : m.pick ? [m.pick] : [];

                  let isDisabled = false;

                  // règles normales
                  if (upperStatus !== 'NS' || ['SUSP', 'INT', 'PST'].includes(upperStatus) || m.is_locked) {
                    isDisabled = true;
                  }
                  if (isBielsaOther) isDisabled = true; // grise les 8 autres

                  // règle supplémentaire : spectateur / éliminé → tout désactivé
                  if (isReadOnly) {
                    isDisabled = true;
                  }

                  // 2bis Affichage BIELSA
                  if (bonusCode === 'BIELSA' && bielsaMatchId) {
                    if (m.id === bielsaMatchId) {
                      // Sur le match BIELSA : afficher la croix choisie dans la pop-up
                      if (paramsPick) picksForThisMatch = [paramsPick];
                    } else {
                      // Tous les autres matchs : non jouables + aucune croix visible
                      isDisabled = true;
                      picksForThisMatch = [];
                    }
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
                      className="border rounded-lg grid grid-cols-[14%_24%_19%_24%_11%] gap-2 items-center"
                    >
                    {/* LIGNE 1 */}
                    <div className="text-center text-sm">{fmtDate(m.date)}</div>

                    {/* Nom équipe domicile : short sur mobile, complet sur PC */}
                    <div className="text-center font-medium">
                      <span className="sm:hidden">{m.short_name_home}</span>
                      <span className="hidden sm:inline">{m.home_team}</span>
                    </div>

                    {/* Boutons 1/N/2 */}
                    <div className="grid grid-cols-3 gap-[16px] justify-items-center">
                      {(['1', 'N', '2'] as const).map((opt) => {
                        const isX = isBielsaThis
                          ? (opt === paramsPick)  // match BIELSA → croix = pick du popup (grid_bonus.parameters.pick)
                          : (!isBielsaOther && picksForThisMatch.includes(opt)); // autres cas → logique normale

                        return (
                          <div
                            key={opt}
                            onClick={() => !isDisabled && handlePick(m.id, opt)}
                            className={`w-7 h-6 border rounded flex items-center justify-center text-sm ${
                              isDisabled ? 'opacity-50' : 'cursor-pointer'
                            }`}
                          >
                    {isX ? (
                      <div className="relative w-6 sm:w-8 h-6 sm:h-8">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg viewBox="0 0 100 100" className="w-full h-full">
                            <line x1="10" y1="10" x2="90" y2="90" stroke="black" strokeWidth="8" />
                            <line x1="90" y1="10" x2="10" y2="90" stroke="black" strokeWidth="8" />
                          </svg>
                        </div>
                      </div>
                    ) : (
                      opt
                    )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Nom équipe extérieure : short sur mobile, complet sur PC */}
                    <div className="text-center font-medium">
                      <span className="sm:hidden">{m.short_name_away}</span>
                      <span className="hidden sm:inline">{m.away_team}</span>
                    </div>
                    
                    {/* BONUS */}
                      <div className="flex justify-center">
                        <button
                          onClick={async () => {
                            setOtherPicks([]);

                            const status = String(m.status ?? '').trim().toUpperCase();
                            setPopupMatchStatus(status === 'NS' ? 'NS' : 'OTHER');

                            // ⬇️ capture toutes les infos d’en-tête du match cliqué
                            setPopupMatch({
                              id: String(m.id),
                              home: m.short_name_home || m.home_team || 'Équipe A',
                              away: m.short_name_away || m.away_team || 'Équipe B',
                              base1: m.base_1_points ?? null,
                              baseN: m.base_n_points ?? null,
                              base2: m.base_2_points ?? null,
                            });

                            setShowPopup(true);

// Charge les autres pronos via la RPC simple (grille + match)
const { data, error } = await supabase.rpc('get_other_picks_basic', {
  p_grid_id: grid.id,
  p_match_id: m.id,
  p_competition_id: competitionId,
});
setOtherPicks(data ?? []);

                          }}
                          className="focus:outline-none"
                        >
                          {/* ton rendu d'icône bonus inchangé */}
                          {bonusEntry ? (
                            bonusCode === 'RIBERY' ? (
                              (m.id === matchWin || m.id === matchZero) ? (
                                <Image src={bonusLogos['RIBERY']} alt="RIBERY bonus" width={32} height={32} className="rounded-full"/>
                              ) : (
                                <Image src={bonusLogos['INFO']} alt="bonus inconnu" width={32} height={32} className="rounded-full"/>
                              )
                            ) : m.id === bonusEntry.match_id ? (
                              <Image src={bonusLogos[bonusCode!]} alt={`${bonusCode} bonus`} width={32} height={32} className="rounded-full"/>
                            ) : (
                              <Image src={bonusLogos['INFO']} alt="bonus inconnu" width={32} height={32} className="rounded-full"/>
                            )
                          ) : (
                            <Image src={bonusLogos['INFO']} alt="bonus inconnu" width={32} height={32} className="rounded-full"/>
                          )}
                        </button>
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
                        {m.score_home != null ? m.score_home : ''}
                      </div>
                      <div className="grid grid-cols-3 gap-[16px] text-xs text-center justify-items-center mt-1">
                        <div>{m.base_1_points ?? '-'}</div>
                        <div>{m.base_n_points ?? '-'}</div>
                        <div>{m.base_2_points ?? '-'}</div>
                      </div>
                      <div className="text-center font-semibold">
                        {m.score_away != null ? m.score_away : ''}
                      </div>
                      <div className="text-center text-sm">
                        {m.score_home != null ? `${m.points || 0} pts` : '? pts'}
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
            
        {/* Gate sur le BONUS */}
        {gate.state === 'elimine' && (
          <>
            <img src={ELIM_IMAGES[elimVariant]} alt="Éliminé" className="mx-auto max-w-[240px]" />
            <p className="text-center text-sm text-gray-600">Tu es éliminé de cette compétition.</p>
          </>
        )}
        {gate.state === 'elimine' ? null : gate.state === 'spectateur' ? (
          <>
            <img src={ELIM_IMAGES['spectateur']} alt="Spectateur" className="mx-auto max-w-[240px]" />
            <p className="text-center text-sm text-gray-600">Mode spectateur : bonus indisponibles.</p>
          </>
        ) : (
          <>
            {/* En-tête */}
            <div className="font-medium">
              {noBonusForThisGrid
                ? 'Pas de bonus pour cette grille'
                : (gridBonuses.length > 0
                    ? 'Tu as déjà joué 1 bonus :'
                    : `Joue 1 des ${visibleBonusDefs!.length} bonus :`)}
            </div>

            {/* Liste des defs */}
              {(visibleBonusDefs ?? []).map(b => {
                const isPlayed = gridBonuses.some(gb => gb.bonus_definition === b.id);
                const hasPlayedAny = gridBonuses.length > 0;
                const isBielsa = b.code === 'BIELSA';
                const canPlayBielsa = !bielsaMatchId && !hasStartedPickedMatch; // BIELSA jouable ?

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
  isBielsa
    ? (canPlayBielsa ? (
        <button
          onClick={() => setOpenedBonus(b)}
          className="px-3 py-1 border rounded hover:bg-gray-100"
        >
          JOUER
        </button>
      ) : null) // => bouton caché si BIELSA non jouable
    : (
        <button
          onClick={() => setOpenedBonus(b)}
          className="px-3 py-1 border rounded hover:bg-gray-100"
        >
          JOUER
        </button>
      )
)}

                    {isPlayed && (() => {
                      const bonusEntry = gridBonuses.find(gb => gb.bonus_definition === b.id);
                      const bonusMatch = matches.find(m => m.id === bonusEntry?.match_id);
                      const bonusIsLocked = bonusEntry && (
                        bonusMatch?.status?.toUpperCase?.() !== 'NS' || bonusMatch?.is_locked
                      );

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
              );
            })}
          </>
        )}
      </div>
    </div>

        {/* ── message d'erreur si un joueur parie trop tard = hors jeu ── */}
        {showOffside && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl text-center shadow-xl max-w-xs">
              <img src="/offside.png" alt="Hors-jeu" className="w-40 sm:w-48 mx-auto mb-4" />
              <button
                className="mt-4 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded"
                onClick={() => window.location.reload()}
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* ── POPUP Pronos des Autres ── */}
        {showPopup && popupMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="relative w-full max-w-xl rounded-lg bg-white p-6 shadow-lg">
              {/* close, plus gros */}
              <button
                onClick={() => setShowPopup(false)}
                aria-label="Fermer"
                className="absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-full
                          text-3xl leading-none text-gray-500 hover:text-gray-800 hover:bg-gray-100
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                ×
              </button>

              {/* Titre */}
              <h2 className="text-center text-lg font-semibold">Les pronos des autres joueurs</h2>

              {/* En-tête match (CENTRÉ) */}
              {popupMatchStatus !== 'NS' && (
                <>
                  <div className="mt-2 text-center text-base font-medium">
                    {popupMatch.home}
                    <span className="mx-2">—</span>
                    {popupMatch.away}
                  </div>

                  {/* triplet de points sous le match */}
                  <div className="mt-1 w-fit mx-auto grid grid-cols-5 place-items-center text-sm text-gray-600">
                    <span>{popupMatch.base1 ?? '–'}</span>
                    <span className="text-gray-400">/</span>
                    <span className="font-medium">{popupMatch.baseN ?? '–'}</span>
                    <span className="text-gray-400">/</span>
                    <span>{popupMatch.base2 ?? '–'}</span>
                  </div>

                  {/* Tri */}
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSortMode('rank')}
                      className={`rounded border px-3 py-1 text-sm font-medium ${
                        sortMode === 'rank' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      classement
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortMode('alpha')}
                      className={`rounded border px-3 py-1 text-sm font-medium ${
                        sortMode === 'alpha' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      alphabétique
                    </button>
                  </div>
                </>
              )}

              {/* Corps */}
              {popupMatchStatus === 'NS' ? (
                <div className="mt-6 text-center">
                  <Image src="/NS.png" alt="Match pas commencé" width={260} height={260} className="mx-auto" />
                </div>
              ) : (
<div className="mt-4 max-h-96 overflow-y-auto">
  {otherPicks.length === 0 ? (
    <div className="flex flex-col items-center justify-center py-10 text-gray-500">
      <Image src="/images/empty-box.png" alt="" width={56} height={56} />
      <p className="mt-3 text-sm">Aucun prono trouvé pour ce match dans la compétition.</p>
    </div>
  ) : (
    <div className="mx-auto w-full max-w-[520px]">
      <ul className="flex flex-col gap-0">
        {(sortMode === 'alpha'
            ? [...otherPicks].sort((a: any, b: any) => (a.username ?? '').localeCompare(b.username ?? '', 'fr', {sensitivity:'base'}))
            : otherPicks
          ).map((p: any) => {

  // 1) normalise depuis p.pick si les flags n'existent pas
  const pickVal = String(p.pick ?? '').toUpperCase();
  const pick1 = p.pick_1 ?? (pickVal === '1');
  const pickN  = p.pick_n ?? (pickVal === 'N');
  const pick2 = p.pick_2 ?? (pickVal === '2');
  
  console.log('[others:picks]', p.username, { pickVal, pick1, pickN, pick2 });

          const Square = ({ label, active }: { label: '1'|'N'|'2'; active: boolean }) => (
            <span
              role="button"
              aria-pressed={active}
              aria-disabled="true"
              tabIndex={-1}
              className={`relative inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border bg-white leading-none ${
                active ? 'border-gray-700' : 'border-gray-300'
              }`}
              title={active ? `Pick ${label} (sélectionné)` : `Pick ${label}`}
            >
              {active ? (
                // Croix pleine (2 diagonales), fine (2px)
                <svg viewBox="0 0 30 30" className="absolute inset-0 block">
                  <line x1="2" y1="2" x2="28" y2="28" stroke="black" strokeWidth="2" strokeLinecap="round" />
                  <line x1="28" y1="2" x2="2" y2="28" stroke="black" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                // 1/N/2 normal (pas gras), un peu plus grand
                <span className="text-[14px] font-normal text-gray-800">{label}</span>
              )}
            </span>
          );

          const bonusSrc =
            p.bonus_code && bonusLogos[p.bonus_code]
              ? bonusLogos[p.bonus_code]
              : p.has_bonus
                ? bonusLogos['INFO']
                : null;

          // 🔸 surlignage “comme le classement”
          const isMe = p.user_id === user?.id; // <= même pattern que ton leaderboard

          return (
            <li
              key={p.user_id}
              className={`grid h-[32px] grid-cols-7 px-3 rounded-xl border ${
                isMe ? 'bg-orange-100 border-orange-300' : 'bg-white border-gray-300'
              }`}
              aria-current={isMe ? 'true' : undefined}
            >
              {/* 1–3 : pseudo */}
              <div className="col-span-3 h-full min-w-0">
                <div className="flex h-full items-center">
                  <span className={`truncate leading-none ${isMe ? 'font-bold' : 'font-medium'}`}>
                    {p.username}
                  </span>
                </div>
              </div>

              {/* 4 : 1 */}
              <div className="col-span-1 h-full">
                <div className="flex h-full items-center justify-center">
                  <Square label="1" active={pick1} />
                </div>
              </div>

              {/* 5 : N */}
              <div className="col-span-1 h-full">
                <div className="flex h-full items-center justify-center">
                  <Square label="N" active={pickN} />
                </div>
              </div>

              {/* 6 : 2 */}
              <div className="col-span-1 h-full">
                <div className="flex h-full items-center justify-center">
                  <Square label="2" active={pick2} />
                </div>
              </div>

              {/* 7 : bonus 30×30 */}
              <div className="col-span-1 h-full">
                <div className="flex h-full items-center justify-end">
                  {bonusSrc && (
                    <Image
                      src={bonusSrc}
                      alt="Bonus joué"
                      width={30}
                      height={30}
                      className="block rounded-full"
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  )}
</div>


              )}
            </div>
          </div>
        )}

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
              ) : (openedBonus.code === 'ZLATAN' || openedBonus.code === 'BIELSA') ? (
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
                      <option value="1-2">1 2</option>
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
