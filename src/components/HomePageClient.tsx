'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import type { Grid, Match, BonusDef, GridBonus } from '@/lib/types'

export interface HomePageClientProps {
  grids: Grid[]
  currentGrid: Grid
  picks: Match[]
  bonuses: GridBonus[]
  bonusDefs: BonusDef[]
}

export default function HomePageClient({
  grids,
  currentGrid,
  picks,
  bonuses,
}: HomePageClientProps) {

useEffect(() => {
  supabase.auth.getUser()
    .then(({ data:{ user } }) => setUserId(user?.id ?? null));
}, []);

  // ——— 1) Tes useState initiaux ———
  const [gridsState, setGrids]      = useState<Grid[]>(grids)
  const [grid, setGrid]             = useState<Grid | null>(currentGrid)
  const [matches, setMatches]       = useState<Match[]>(picks)
  const [bonusDefs, setBonusDefs]   = useState<BonusDef[]>([])
  const [gridBonuses, setGridBonuses] = useState<GridBonus[]>(bonuses)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [openedBonus, setOpenedBonus] = useState<BonusDef | null>(null)
  const [popupMatch1, setPopupMatch1] = useState<string>('')
  const [popupMatch0, setPopupMatch0] = useState<string>('')
  const [popupPair, setPopupPair]     = useState<'1–N' | 'N–2' | '1–2'>('1–N')
  const [popupPick, setPopupPick]     = useState<'1' | 'N' | '2'>('1')
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const initialPage  = Number(searchParams.get('page')) || 0
  const [currentIdx, setCurrentIdx] = useState(initialPage)
  const defsToPlay = bonusDefs.filter(b => allowedBonuses.includes(b.id))

  // ——— 2) Fonctions de navigation ———
  const goToPage = (i: number) => {
    setCurrentIdx(i)
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.set('page', String(i))
    router.replace(`${pathname}?${params.toString()}`, undefined, { shallow: true })
  }
  const prevGrid = () => void (currentIdx > 0 && goToPage(currentIdx - 1))
  const nextGrid = () => void (currentIdx < gridsState.length - 1 && goToPage(currentIdx + 1))
  const currentGrid2 = gridsState[currentIdx] || { title: '', description: '' }
  const [loadingGrids, setLoadingGrids] = useState(false)
  const [loadingGrid, setLoadingGrid]   = useState(false)
  const [scores, setScores] = useState<{ grid_match_id: string; pick: string; points: number }[]>([])
  const [tab, setTab]       = useState<'grille' | 'classement'>('grille')
  const [userId, setUserId] = useState<string | null>(null)
  const [totalPoints, setTotalPoints] = useState<number>(0)
  const [errorScores, setErrorScores] = useState<string | null>(null)
  const [errorGrids, setErrorGrids]   = useState<string | null>(null)
  const [errorGrid, setErrorGrid]     = useState<string | null>(null)

    // Upsert pronostic 1/N/2
  const handlePick = async (
    match_id: string,
    pick: '1' | 'N' | '2'
  ) => {
    // On retrouve l'objet match localement
    const m = matches.find(x => x.id === match_id);
    if (!m) return;
    // On n'upsert pas si le match est déjà commencé
    if (new Date(m.date) <= new Date()) return;

    // 1) Upsert du pick SEUL
    const { error: pe } = await supabase
      .from('grid_matches')
      .upsert(
        { grid_id: grid.id, match_id, pick,user_id: userId },
        { onConflict: ['grid_id','match_id'] }
      );
    if (pe) {
      console.error('Erreur upsert pick:', pe);
      return;
    }

    // 2) Mise à jour locale du pick
    setMatches(ms =>
      ms.map(x =>
        x.id === match_id
          ? { ...x, pick }
          : x
      )
    );

    // 3) Recalcul des points via RPC
    const { data: newScores, error: re } = await supabase
      .rpc('compute_scores', { p_grid_id: grid.id });
    if (re) {
      console.error('Erreur compute_scores après pick:', re);
      return;
    }
    // On injecte les nouveaux points dans le state 'matches'
    const scoreMap = new Map<string, number>(
      (newScores as any[]).map(r => [r.grid_match_id, r.points])
    );
    setMatches(ms =>
      ms.map(x => ({
        ...x,
        points: scoreMap.get(x.id) ?? 0
      }))
    );
  };

  // Validation / modification
  const handleBonusValidate = async () => {
    if (!openedBonus) return;
  
    try {
      // 1) On voit arriver le bonus
      console.log('🔥 handleBonusValidate start', {
        bonusCode:   openedBonus.code,
        popupMatch1, popupMatch0, popupPair, popupPick
      });
  
      // 2) Payload de base
      const payload: any = {
        grid_id:          grid!.id,         // UUID de la grille
        bonus_definition: openedBonus.id,   // UUID du bonus
        match_id:         popupMatch1,      // pour KANTÉ/ZLATAN, c'est le match ; pour RIBÉRY, on prend match_win
        parameters:       {}                // 
      };
  
      // 3) Complète selon le code du bonus
      switch (openedBonus.code) {
        case 'KANTE':
          if (!popupMatch1) {
            console.warn('KANTE sans match'); 
            return;
          }
          payload.parameters = {
            picks:
              popupPair === '1–N' ? ['1','N']
            : popupPair === 'N–2' ? ['N','2']
            : ['1','2']
          };
          break;
  
        case 'RIBERY':
          if (!popupMatch1 || !popupMatch0) {
            alert('Choisissez les deux matchs');
            return;
          }
          if (popupMatch1 === popupMatch0) {
            alert('Même match deux fois');
            return;
          }
          payload.match_id = popupMatch1;      // on stocke le match à 3 croix
          payload.parameters = {
            match_win:  popupMatch1,
            match_zero: popupMatch0
          };
          break;
  
        case 'ZLATAN':
          if (!popupMatch1) {
            console.warn('ZLATAN sans match');
            return;
          }
          // payload.match_id est déjà popupMatch1
          payload.parameters = {
            pick: popupPick
          };
          break;
  
        default:
          console.error('Bonus non géré :', openedBonus.code);
          return;
      }
  
      // 4) Vérif dans la console
      console.log('→ payload avant upsert:', payload);
  
      // 5) Envoi à Supabase
      const { data, error: be } = await supabase
        .from('grid_bonus')
        .upsert(payload, {
          onConflict: ['grid_id','bonus_definition']
        });
  
      if (be) {
        console.error('❌ Supabase upsert error', be);
        alert('Erreur Supabase : ' + be.message);
        return;
      }
      console.log('✅ Supabase upsert OK', data);
  
      // 6) Mise à jour locale + fermeture popup
      setGridBonuses(gbs => [
        ...gbs.filter(x => x.bonus_definition !== openedBonus.id),
        {
          bonus_definition: openedBonus.id,
          match_id:         payload.match_id,  // pour KANTE/ZLATAN : le match, pour Ribéry : match_win
          parameters:       payload.parameters
        }
      ]);
      setOpenedBonus(null);
      setPopupMatch1('');
      setPopupMatch0('');
    }
    catch (e: any) {
      console.error('🔥 handleBonusValidate catch', e);
      alert('Erreur enregistrement bonus : ' + (e.message || e));
    }
  };      

  // Suppression d’un bonus
  const handleBonusDelete = async () => {
    if (!openedBonus) return;
    try {
      // 1) Suppression en base
      const { error: de } = await supabase
        .from('grid_bonus')
        .delete()
        .eq('grid_id', grid.id)
        .eq('bonus_definition', openedBonus.id);
      if (de) throw de;

      // 2) Mise à jour locale de gridBonuses
      setGridBonuses(gbs =>
        gbs.filter(x => x.bonus_definition !== openedBonus.id)
      );

      // 3) Recalcul des points via RPC
      const { data: newScores, error: re } = await supabase
        .rpc('compute_scores', { p_grid_id: grid.id });
      if (re) {
        console.error('Erreur compute_scores après delete bonus:', re);
      } else {
        const scoreMap = new Map<string, number>(
          (newScores as any[]).map(r => [r.grid_match_id, r.points])
        );
        // 4) Mise à jour de matches avec les nouveaux points
        setMatches(ms =>
          ms.map(x => ({
            ...x,
            points: scoreMap.get(x.id) ?? 0
          }))
        );
      }

      // 5) Reset du popup
      setOpenedBonus(null);
      setPopupMatch1('');
      setPopupMatch0('');
    }
    catch (e: any) {
      console.error('🔥 handleBonusDelete catch', e);
      alert('Erreur suppression bonus : ' + (e.message || e));
    }
  };

  // helpers bonus
  const isPlayed = gridBonuses.length>0;
  const playedBonusCode = bonusDefs.find(b=>b.id===gridBonuses[0]?.bonus_definition)?.code;

  // format FR pour la date
  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('fr-FR',{
      day:'2-digit', month:'2-digit',
      hour:'2-digit', minute:'2-digit'
    }).replace(/\u202F/g,' ');

    // ── 1) Gestion de la session utilisateur (chargement initial + écoute login/logout) ──
  useEffect(() => {
    async function getSession() {
      const {
        data: { session },
        error
      } = await supabase.auth.getSession()
      if (error) {
        console.error('Impossible de lire la session', error.message)
      } else if (session?.user?.id) {
        setUserId(session.user.id)
      }
    }
    getSession()

    // en plus, on peut écouter le changement de session (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  // — 2) LoadAllGrids : charge la liste de TOUTES les grilles —
  useEffect(() => {
    async function loadAllGrids() {
      try {
        setLoadingGrids(true);
        const { data, error } = await supabase
          .from<'grids'>('grids')
          .select('id, title, description')
          .order('created_at', { ascending: true });

        if (error) throw error;
        console.log('▶️ loadAllGrids →', data);
        setGrids(data || []);
      } catch (e: any) {
        console.error('❌ loadAllGrids error', e.message);
        setError('Impossible de charger les grilles : ' + (e.message ?? e));
      } finally {
        setLoadingGrids(false);
      }
    }

    loadAllGrids();
  }, []);  // <- empty deps: run once on mount


  // ── 3) LoadComputeScores : appelle l’RPC compute_scores dès qu’on a grid.id ──
  useEffect(() => {
    if (!grid?.id) return;

    async function loadComputeScores() {
      try {
        setErrorScores(null);
        const { data, error } = await supabase
          .rpc('compute_scores', { p_grid_id: grid.id });
          console.log('🚀 compute_scores →', { gridId: grid.id, data, error });
        if (error) throw error;

        // 1) Stocke les lignes retournées
        setScores(data as { grid_match_id: string; pick: string; points: number }[]);

        // 2) Calcule la somme des points et l’enregistre
        const sum = (data as any[]).reduce((acc, row) => acc + (row.points ?? 0), 0);
        setTotalPoints(sum);
      } catch (e: any) {
        console.error('Erreur LoadComputeScores', e.message);
        setErrorScores('Impossible de calculer les points : ' + (e.message ?? e));
      }
    }

    loadComputeScores();
  }, [grid?.id]);
 
  // — 4) LoadActiveGrid : charge la grille sélectionnée et ses données —  
  useEffect(() => {
    if (grids.length === 0) return;
    const gridId = grids[currentIdx].id;
    if (!gridId) return;

    (async () => {
      try {
        setLoadingGrid(true);

        // 1) On fetch la définition de la grille (pour récupérer allowed_bonuses + grid_items)
        const { data: g, error: ge } = await supabase
          .from<Grid>('grids')
          .select(`id, title, grid_items(match_id), allowed_bonuses`)
          .eq('id', gridId)
          .single();
        if (ge) throw ge;
        setGrid(g);

        // 2) On prépare la liste des match_id à récupérer
        const ids = (g.grid_items || []).map(x => x.match_id);

        // 3) On fetch les matchs ET **seuls** les pronos du user courant**  
        const { data: raws, error: re } = await supabase
          .from<RawMatch>('matches')
          .select(`
            id,
            date,
            home_team,
            away_team,
            score_home,
            score_away,
            odds(odd_1,odd_X,odd_2),
            grid_matches(user_id,pick)
          `)
          .in('id', ids)
          .order('date', { ascending: true });
        if (re) throw re;

        console.log('🔍 raws fetched =', raws);

        // 4) On nettoie le format
        const clean = (raws || []).map(m => {
          const o  = m.odds[0]    || { odd_1:0, odd_X:0, odd_2:0 };
          const gm = m.grid_matches[0];  // ce sera forcément ton user
          return {
            id:         m.id,
            date:       m.date,
            home_team:  m.home_team,
            away_team:  m.away_team,
            score_home: m.score_home,
            score_away: m.score_away,
            odd_1:      o.odd_1,
            odd_X:      o.odd_X,
            odd_2:      o.odd_2,
            pick:       gm?.pick   ?? null,
            points:     gm?.points ?? null,
          };
        });
        setMatches(clean);

          // bonusDefinition…
          // etc. (le reste de votre code bonus)

        } catch (e: any) {
          console.error('‼️ LoadActiveGrid error for gridId=', gridId, e);
          setErrorGrid('Impossible de charger la grille active : ' + (e.message||e));
        } finally {
          setLoadingGrid(false);
        }
      })();
    }, [grids, currentIdx]);

  if (loadingGrids) {return ( <main className="flex items-center justify-center min-h-screen"> 🔄 Chargement des grilles…  </main>  );}
  if (error)   return <div className="p-6 text-red-600">⚠ {error}</div>;
  if (!grid)   return <div className="p-6">Aucune grille disponible</div>;

  return (
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

    {/* 2) POINTS — total par grille */}
    <div className="w-full md:w-1/3 text-center mb-4 md:mb-0">
      <span className="text-lg font-semibold">POINTS :</span>
      <span className="ml-2 text-gray-600">
        {totalPoints != null ? `${totalPoints} pts` : '–'}
      </span>
    </div>

    {/* 3) DESCRIPTION DE LA GRILLE (inchangé pour l’instant) */}
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
                          className={`w-8 h-8 mx-auto border rounded flex items-center justify-center text-sm ${
                            isDisabled ? 'opacity-50' : 'cursor-pointer'
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
                      {Math.round(m.odd_1 * Math.PI)}
                    </div>
                    <div className="text-center text-xs">
                      {Math.round(m.odd_X * Math.PI)}
                    </div>
                    <div className="text-center text-xs">
                      {Math.round(m.odd_2 * Math.PI)}
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
            <div>
                Joue {defsToPlay.length} des {defsToPlay.length} bonus :
                {defsToPlay.map(def => (
                <BonusCard key={def.id} def={def} /* … */ />
                ))}
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
                    {matches.map((m) => (
                      <option
                        key={m.id}
                        value={String(m.id)}
                      >
                        {m.home_team} vs {m.away_team}
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
                    {matches.map((m) => (
                      <option
                        key={m.id}
                        value={String(m.id)}
                      >
                        {m.home_team} vs {m.away_team}
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
                    {matches.map((m) => (
                      <option
                        key={m.id}
                        value={String(m.id)}
                      >
                        {m.home_team} vs {m.away_team}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block mb-6">
                  Pronostic
                  <select
                    value={popupPick}
                    onChange={(e) =>
                      setPopupPick(e.target.value as any)
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
                    {matches.map((m) => (
                      <option
                        key={m.id}
                        value={String(m.id)}
                      >
                        {m.home_team} vs {m.away_team}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block mb-6">
                  Paire de croix
                  <select
                    value={popupPair}
                    onChange={(e) =>
                      setPopupPair(e.target.value as any)
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
)
}
