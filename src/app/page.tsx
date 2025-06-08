'use client';
// Déclarations de types pour HomePage

type BonusParameters =
  | { picks: string[] }         // Kanté
  | { match_win: string; match_zero: string } // Ribéry
  | { pick: string };           // Zlatan

import type { User } from '@supabase/supabase-js';
import type { Grid, Match, GridBonus, BonusDef, MatchWithOdds } from '@/lib/types';
import { NavBar } from '@/components/NavBar';
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const bonusLogos: Record<string,string> = {
  KANTE: '/images/kante.png',
  RIBERY: '/images/ribery.png',
  ZLATAN: '/images/zlatan.png',
};

export default function HomePage() {
  // 👉 État principal de l'utilisateur connecté (renseigné au chargement)
  const [user, setUser] = useState<User | null>(null);
  // 👉 Liste complète des grilles du joueur
  const [grids, setGrids] = useState<Grid[]>([]);
  // 👉 Grille actuellement sélectionnée (par index ou en navigation)
  const [grid, setGrid] = useState<Grid | null>(null);
  // 👉 Liste des matchs de la grille active
  const [matches, setMatches] = useState<Match[]>([]);
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
  const [popupPair, setPopupPair] = useState<'1–N' | 'N–2' | '1–2'>('1–N');
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
  const pathname     = usePathname();
  // 👉 Change l’index ET met à jour l’URL en shallow routing
  const goToPage = (i: number) => {    setCurrentIdx(i);
    // Reconstruit les params en conservant les autres éventuels
    const params = new URLSearchParams(Array.from(searchParams?.entries?.() ?? []));
    params.set('page', String(i));
    router.replace(`${pathname}?${params.toString()}`);
  // 👉 Fonctions de navigation
  const prevGrid = () => {    if (currentIdx > 0) goToPage(currentIdx - 1);  };
  const nextGrid = () => {    if (currentIdx < grids.length - 1) goToPage(currentIdx + 1);  };
  const currentGrid = grids[currentIdx] || { title: '', description: '' };

  // 👉 Format FR pour la date
  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('fr-FR',{
      day:'2-digit', month:'2-digit',
      hour:'2-digit', minute:'2-digit'
    }).replace(/\u202F/g,' ');  

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
  async function loadUserGrids(userId: string) {
    const { data: matchData, error: matchError } = await supabase
      .from("grid_matches")
      .select(`
        grid_id,
        match_id,
        pick,
        points,
        matches (
          date,
          home_team,
          away_team,
          base_1_points,
          base_n_points,
          base_2_points
        ),
        grids (
          id,
          title,
          description
        )
      `)
      .eq("user_id", userId);

    if (matchError) {
      setError("Erreur chargement grilles.");
      setLoadingGrids(false);
      return;
    }

    const groupedByGrid: Record<string, { grid: Grid; matches: MatchWithOdds[] }> = {};
    const typedMatchData = matchData as MatchWithOdds[];
    for (const m of typedMatchData) {
      const gridId = m.grid_id;
      if (!groupedByGrid[gridId]) {
        groupedByGrid[gridId] = {
          grid: {
            id: gridId,
            title: m.grids.title,
            description: m.grids.description,
            allowed_bonuses: m.grids.allowed_bonuses ?? [],
          },
          matches: [],
        };
      }
    const match = m as MatchWithOdds;

    groupedByGrid[gridId].matches.push({
      id: match.match_id,
      date: match.matches.date,
      home_team: match.matches.home_team,
      away_team: match.matches.away_team,
      odd_1: match.matches.base_1_points,
      odd_X: match.matches.base_n_points,
      odd_2: match.matches.base_2_points,
      pick: match.pick,
      points: match.points ?? 0,
    });
    }

    const gridsList = Object.values(groupedByGrid).map((g) => g.grid);
    const gridIds = Object.keys(groupedByGrid);
    const selectedGridId = gridIds[currentIdx];
    const currentGridMatches = groupedByGrid[selectedGridId]?.matches || [];

    setGrids(gridsList);
    setGrid(gridsList[0]);
    setMatches(currentGridMatches);
    setLoadingGrids(false);
  }

  // 🧩 Charge la grille active + les matchs + picks + points + bonus
  useEffect(() => {
    if (grids.length === 0) return;
    const gridId = grids[currentIdx].id;
    if (!gridId) return;

    (async () => {
      try {
        setLoadingGrid(true);

        // 1) Fetch de la grille active
        const { data: g, error: ge } = await supabase
          .from('grids')
          .select(`id, title, grid_items(match_id), allowed_bonuses`)
          .eq('id', gridId)
          .single();
        if (ge) throw ge;
        setGrid(g);
        console.log("📦 grille active chargée :", g);

        // 2) Préparer la liste des match_id à récupérer
        const ids = (g.grid_items || []).map((x: { match_id: number }) => x.match_id);
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
        const clean = (raws || []).map(m => {
          const match = m as MatchWithOdds;
          // trouver l'enregistrement grid_match pour ce match
          const gm = rawGridMatches?.find(gm => gm.match_id === m.id);
          return {
            id:         match.id,
            date:       match.date,
            home_team:  match.home_team,
            away_team:  match.away_team,
            score_home: match.score_home,
            score_away: match.score_away,
            odd_1:      match.odd_1_snapshot,
            odd_X:      match.odd_n_snapshot,
            odd_2:      match.odd_2_snapshot,
            base_1_points: match.base_1_points,
            base_n_points: match.base_n_points,
            base_2_points: match.base_2_points,

            pick:       gm?.pick ?? null,
            points:     gm?. points ?? 0,
          };
        });
        setMatches(clean);
        const totalPoints = clean.reduce((acc, m) => acc + (m.points || 0), 0);
        setTotalPoints(totalPoints);

        // 6) Fetch des bonus déjà joués pour cette grille
        const { data: gbs, error: gbe } = await supabase
          .from('grid_bonus')
          .select('bonus_definition, match_id, parameters')
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

  // ✅ Mise à jour automatique des points
  useEffect(() => {
    if (!grid?.id || matches.length === 0) return;

    const interval = setInterval(async () => {
      const now = new Date();

      const ongoing = matches.some(m =>
        m.date && new Date(m.date) <= now && m.score_home === null
      );

      if (!ongoing) return;

      console.log("🌀 Match en cours détecté, mise à jour des points...");
      const { error } = await supabase.rpc("update_grid_points", { p_grid_id: grid.id });
      if (error) {
        console.error("❌ Erreur update_grid_points :", error);
      } else {
        console.log("✅ update_grid_points exécuté !");
        if (user?.id) await loadUserGrids(user.id);
      }
    }, 60_000);

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

    const { error } = await supabase
      .from('grid_matches')
      .upsert([{
        user_id: user.id,
        grid_id: grid.id,
        match_id,
        pick
      }, {
        onConflict: ['user_id', 'grid_id', 'match_id']
      }]);

    if (error) {
      console.error("Erreur enregistrement pick :", error);
      return;
    }

    // ✅ Recharge les grilles après pick
    await loadUserGrids(user.id);
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
        match_id: number;
        parameters: BonusParameters;
      } = {
        user_id: user.id,
        grid_id: grid.id,
        bonus_definition: openedBonus.id,
        match_id: Number(popupMatch1),
        parameters: { picks: [] },
      };

      // 3) Logique spécifique à chaque bonus
      switch (openedBonus.code) {
        case 'KANTE':
          if (!popupMatch1) return alert('Match requis pour Kanté');
          payload.parameters = {
            picks:
              popupPair === '1–N' ? ['1', 'N']
            : popupPair === 'N–2' ? ['N', '2']
            : ['1', '2']
          };
          break;

        case 'RIBERY':
          if (!popupMatch1 || !popupMatch0)
            return alert('Sélectionnez 2 matchs différents pour Ribéry');
          if (popupMatch1 === popupMatch0)
            return alert('Les 2 matchs doivent être différents');
          payload.match_id = Number(popupMatch1) || 0;
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
        await loadUserGrids(user.id); // Recharge les grilles après validation bonus

      if (be) throw be;
      console.log('✅ Supabase upsert OK', data);

      // 5) Update local
      setGridBonuses(gbs => [
        ...gbs.filter(b => b.bonus_definition !== openedBonus.id),
        {
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

      // 3) Recharge propre de la grille
      await loadUserGrids(user.id);

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

return (
      <>
      <NavBar />
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
          {currentGrid?.title /* <-- Assure-toi que c’est bien currentGrid, pas grid */}
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
          {currentGrid?.description /* <-- idem, currentGrid */}
        </p>
      </div>
    </div>
  </section>

      {/* 2) CONTENU PRINCIPAL : GRILLE (2/3) & BONUS (1/3) */}
      <div className="p-6 flex flex-col lg:flex-row gap-6">
        {/* ── GRILLE ── */}
        <div className="w-full lg:w-2/3">
          <div className="border rounded-lg space-y-2">
            <h1 className="text-3xl font-bold text-center p-2">{currentGrid?.title}</h1>
            <div className="space-y-1">
              {loadingGrid ? (
                <div className="p-6 text-center">🔄 Chargement de la grille…</div>
              ) : (
                matches.map((m) => {
                  const now = new Date()
                  const dt = new Date(m.date)
                  const upcoming = dt > now
                  const isMatchLocked = m.status !== 'NS' || m.is_locked;

                  // 1) Bonus actif
                  const bonusEntry = gridBonuses[0]
                  const bonusDef = bonusDefs.find(
                    (d) => d.id === bonusEntry?.bonus_definition
                  )
                  const bonusCode = bonusDef?.code
                  const params = bonusEntry?.parameters || {}
                  const matchWin  = params.match_win as string
                  const matchZero = params.match_zero as string

                  // 2) Prépare picks et disabled
                  let picksForThisMatch: string[] = []
                  let isDisabled = !upcoming

                  if (bonusEntry && bonusCode) {
                    switch (bonusCode) {
                      case 'RIBERY': {
                        if (m.id === matchWin) {
                          picksForThisMatch = ['1','N','2'];
                          isDisabled = true
                        } else if (m.id === matchZero) {
                          picksForThisMatch = []
                          isDisabled = true
                        } else {
                          picksForThisMatch = m.pick ? [m.pick] : []
                        }
                        break
                      }
                      case 'KANTE': {
                        const matchK = bonusEntry.match_id
                        if (m.id === matchK) {
                          picksForThisMatch = params.picks || []
                          isDisabled = true
                        } else {
                          picksForThisMatch = m.pick ? [m.pick] : []
                        }
                        break
                      }
                      case 'ZLATAN': {
                        const matchZ = bonusEntry.match_id
                        if (m.id === matchZ) {
                          picksForThisMatch = params.pick ? [params.pick] : []
                          isDisabled = true
                        } else {
                          picksForThisMatch = m.pick ? [m.pick] : []
                        }
                        break
                      }
                      default:
                        picksForThisMatch = m.pick ? [m.pick] : []
                    }
                  } else {
                    picksForThisMatch = m.pick ? [m.pick] : []
                  }

                  return (
                    <div
                      key={m.id}
                      className="border rounded-lg grid grid-cols-7 grid-rows-2 items-center p-1"
                    >
                      {/* LIGNE 1 */}
                      <div className="text-center text-sm">{fmtDate(m.date)}</div>
                      <div className="text-center font-medium">{m.home_team}</div>
                      {(['1', 'N', '2'] as const).map((opt) => {
                        const isX = picksForThisMatch.includes(opt)
                        return (
                          <div
                            key={opt}
                            onClick={() =>
                              !isDisabled &&
                              handlePick(
                                m.id,
                                opt,
                                opt === '1'
                                  ? m.odd_1
                                  : opt === 'N'
                                  ? m.odd_X
                                  : m.odd_2
                              )
                            }
                            className={`w-8 h-8 mx-auto border rounded flex items-center justify-center text-sm 
                              ${isMatchLocked ? 'opacity-50' : 'cursor-pointer'
                            }`}
                          >
                            {isX ? 'X' : opt}
                          </div>
                        )
                      })}
                      <div className="text-center font-medium">{m.away_team}</div>
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
                      <div className="text-center text-xs text-gray-600">
                        {m.score_home != null ? 'Terminé' : 'À venir'}
                      </div>
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
                    {isPlayed && (
                      <button
                        onClick={() => setOpenedBonus(b)}
                        className="px-3 py-1 border rounded hover:bg-gray-100"
                      >
                        MODIFIER
                      </button>
                    )}
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
                      {matches.filter(m => m.status === 'NS' && !m.is_locked).map((m) => (
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
                      {matches.filter(m => m.status === 'NS' && !m.is_locked).map((m) => (
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
                      {matches.filter(m => m.status === 'NS' && !m.is_locked).map((m) => (
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
                      onChange={(e) =>
                        setPopupPick(e.target.value)
                      }
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
                      {matches.filter(m => m.status === 'NS' && !m.is_locked).map((m) => (
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
                      onChange={(e) =>
                        setPopupPair(e.target.value)
                      }
                      className="mt-1 block w-full border rounded p-2"
                    >
                      <option value="1–N">1 – N</option>
                      <option value="N–2">N – 2</option>
                      <option value="1–2">1 – 2</option>
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
};
}
