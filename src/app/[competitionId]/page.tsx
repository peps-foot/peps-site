'use client';

type BonusPick = '1' | 'N' | '2';

type BonusParameters = {
  // communs
  pick?: BonusPick;                // 1 seul pick (ZLATAN, BIELSA, BUTS, CLEAN_SHEET, ECART, BOOST_x…)
  picks?: BonusPick[];             // plusieurs picks (KANTÉ)
  match_win?: string;              // RIBÉRY : match avec 3 croix
  match_zero?: string;             // RIBÉRY : match avec 0 croix
  // tolérant pour l’avenir
  [k: string]: any;
};

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

type CroixCode = 'KANTE' | 'RIBERY' | 'ZLATAN' | 'BIELSA';

function isCroixCode(code: BonusDef['code']): code is CroixCode {
  return (['KANTE','RIBERY','ZLATAN','BIELSA'] as const).includes(code as CroixCode);
}
type RiberyParams = { match_win?: string; match_zero?: string };
const isRibery = (code?: string) => code === 'RIBERY';

import type { User } from '@supabase/supabase-js';
import type { Grid, Match, GridBonus, BonusDef, GridWithItems, MatchWithState, RawMatchRow } from '../../lib/types';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useSupabase } from '../../components/SupabaseProvider'
import { useRouter, useSearchParams, useParams} from 'next/navigation';
import { usePlayerGate } from '../../hooks/usePlayerGate';
import { handleBonusValidateCroix }     from "../../features/bonus/handlersCroix";
import { handleBonusValidateScore }     from "../../features/bonus/handlersScore";
import { handleBonusValidateSpeciaux }  from "../../features/bonus/handlersSpeciaux";
// pour la gestion des cases 1N2 quand il y a un bonus
import { computeOverlay } from '../../features/bonus/computeOverlay';
import type { OverlayEntry } from '../../features/bonus/computeOverlay';
import CompetitionInfoPanel from "../../components/CompetitionInfoPanel";


import supabase from '../../lib/supabaseBrowser';

const bonusLogos: Record<string,string> = {
  "KANTE": '/images/kante.png',
  "RIBERY": '/images/ribery.png',
  "ZLATAN": '/images/zlatan.png',
  "BIELSA" : '/images/bonus/bielsa.png',
  "BUTS" : '/images/bonus/buts.png',
  "CLEAN SHEET" : '/images/bonus/CS.png',
  "CLEAN_SHEET" : '/images/bonus/CS.png',
  "ECART" : '/images/bonus/ecart.png',
  "BOOST_1" : '/images/bonus/boost_1.png',
  "BOOST_2" : '/images/bonus/boost_2.png',
  "BOOST_3" : '/images/bonus/boost_3.png',
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
  const specialDefs = React.useMemo(
    () => bonusDefs.filter(d => d.category_id === 'SPECIAL' || d.code.startsWith('BOOST_')),
    [bonusDefs]
  );
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
  type View = 'grid' | 'rankGrid' | 'rankGeneral' | 'info';
  // accordéon pour la grille
  const [openGrille, setOpenGrille] = useState(true); // ouverte par défaut
  
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
  //const [competition, setCompetition] = useState<{ id: string; name: string; mode: string } | null>(null);
  const [competition, setCompetition] = useState<any | null>(null);
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
        .select('id, name, mode, kind, join_code, created_by')
        .eq('id', competitionId)
        .maybeSingle();

      if (error) {
        console.warn('[competitions] ERROR', error.message);
        setCompetition(null);
      } else if (!data) {
        console.log('[competitions] NOT_FOUND');
        setCompetition(null);
      } else {
        console.log('[competitions] OK', {
          id: data.id,
          mode: data.mode,
          kind: data.kind,
        });
        setCompetition(data);
        console.log('[competitions] fetched', {
          id: data?.id,
          name: data?.name,
          rawMode: `‹${data?.mode}›`,
          kind: data?.kind,
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

  // pour savoir quel bonus affiché dans la zone bonus
  const allowedIds = (grid?.allowed_bonuses ?? null) as string[] | null;

  const visibleBonusDefs =
    allowedIds === null
      ? null                               // => "Pas de bonus pour cette grille"
      : bonusDefs.filter(b => allowedIds.includes(b.id));

  const noBonusForThisGrid = visibleBonusDefs === null;

  //pour les 3 zones bonus
  const CROIX_CODES   = new Set(['KANTE','RIBERY','ZLATAN','BIELSA']);
  const SCORE_CODES   = new Set(['BUTS','CLEAN SHEET','ECART']);
  const SPECIAL_CODES = new Set(['BOOST_1','BOOST_2','BOOST_3']);

  function getCatName(b: any) {
    return b?.category?.name
      || (CROIX_CODES.has(b.code) ? 'CROIX'
      : SCORE_CODES.has(b.code) ? 'SCORE'
      : SPECIAL_CODES.has(b.code) ? 'SPECIAL'
      : 'SPECIAL');
  }

  const defsCroix = React.useMemo(
    () => (visibleBonusDefs ?? []).filter(b => getCatName(b) === 'CROIX'),
    [visibleBonusDefs]
  );
  const defsScore = React.useMemo(
    () => (visibleBonusDefs ?? []).filter(b => getCatName(b) === 'SCORE'),
    [visibleBonusDefs]
  );
  const defsSpecial = React.useMemo(
    () => (visibleBonusDefs ?? []).filter(b => getCatName(b) === 'SPECIAL'),
    [visibleBonusDefs]
  );

  // Pour le POP-UP BONUS

  // Pour retirer les match NS et les match ayant déjà un bonus des listes pop-ups
    // Rendu d'une ligne BONUS
// map id -> {code, category_id}
const bonusDefById = React.useMemo(() => {
  const m: Record<string, { code: string; category_id: string }> = {};
  for (const d of bonusDefs ?? []) m[d.id] = { code: d.code, category_id: d.category_id };
  return m;
}, [bonusDefs]);

// liste des codes joués sur la grille
const codesPlayed: string[] = React.useMemo(
  () =>
    gridBonuses
      .map(gb => bonusDefById[gb.bonus_definition]?.code)
      .filter(Boolean) as string[],
  [gridBonuses, bonusDefById]
);
  // ids des matches déjà pris (toutes catégories confondues)
type RiberyParams = { match_win?: string; match_zero?: string };

const takenMatchIds = React.useMemo(() => {
  const s = new Set<string>();
  for (const gb of gridBonuses ?? []) {
    if (gb.match_id) s.add(String(gb.match_id));

    // Sécurise RIBERY : ajoute match_win et match_zero
    const def  = bonusDefById[gb.bonus_definition];
    const code = def?.code;
    if (code === 'RIBERY') {
      const rp = gb.parameters as RiberyParams | undefined;
      const win  = rp?.match_win  ? String(rp.match_win)  : '';
      const zero = rp?.match_zero ? String(rp.match_zero) : '';
      if (win)  s.add(win);
      if (zero) s.add(zero);
    }
  }
  return s;
}, [gridBonuses, bonusDefById]);



// Helper commun : match visible si NS, pas locké, et pas déjà pris
const isMatchSelectable = (m:any) =>
  (String(m.status ?? '').toUpperCase() === 'NS') &&
  !m.is_locked &&
  !takenMatchIds.has(String(m.id));

  // 1) Typage
  type PopupKind = 'CROIX' | 'SCORE' | 'SPECIAL' | null;

  const popupKind: PopupKind = React.useMemo(() => {
    const code = openedBonus?.code;
    if (!code) return null;
    if (['KANTE','RIBERY','ZLATAN','BIELSA'].includes(code)) return 'CROIX';
    if (['BUTS','CLEAN SHEET','ECART'].includes(code))       return 'SCORE';
    if (['BOOST_1','BOOST_2','BOOST_3'].includes(code))      return 'SPECIAL';
    return null;
  }, [openedBonus]);

  // 2) Applique ou modifie un bonus CROIX pour la grille active
  const handleBonusValidateCroixLocal = async () => {
    if (!openedBonus || !isCroixCode(openedBonus.code)) {
      // sécurité : si jamais on arrive ici avec un non-CROIX, on ne fait rien
      return;
    }

    if (!grid) {
      // au choix: toast, console, return…
      console.warn("Impossible de valider le bonus CROIX : grid est null.");
      return;
    }

    await handleBonusValidateCroix({
      user,
      grid,
      matches,
      gridBonuses,
      openedBonus: { id: openedBonus.id, code: openedBonus.code }, // ← désormais typé CroixCode
      popupMatch1,
      popupMatch0,
      popupPair,
      popupPick,
      setShowOffside,
      setOpenedBonus,
      setPopupMatch1,
      setPopupMatch0,
      setGridBonuses,
    });
  };

  // 3) Applique ou modifie un bonus SCORE pour la grille active
  const handleBonusValidateScoreLocal = async () => {

  if (!grid) {
    console.warn("Impossible de valider le bonus SCORE : grid est null.");
    // tu peux aussi afficher un toast et fermer la popup si besoin
    return;
  }

    await handleBonusValidateScore({
      user,
      grid,
      matches,
      gridBonuses,
      openedBonus: openedBonus as any, // 'BUTS' | 'CLEAN_SHEET' | 'ECART'
      popupMatch1,
      popupPick,
      setShowOffside,
      setOpenedBonus,
      setPopupMatch1,
      setGridBonuses,
    });
  };

  // 4) Applique ou modifie un bonus SPECIAL pour la grille active
  const handleBonusValidateSpeciauxLocal = async () => {

  if (!grid) {
    console.warn("Impossible de valider le bonus SPECIAL : grid est null.");
    return;
  }

    await handleBonusValidateSpeciaux({
      user,
      grid,
      matches,
      gridBonuses,
      openedBonus: openedBonus as any, // 'BOOST_1' | 'BOOST_2' | 'BOOST_3'
      popupMatch1,
      popupPick,
      setShowOffside,
      setOpenedBonus,
      setPopupMatch1,
      setGridBonuses,
    });
  };

  // 5) Utilisation des handlers dans la pop-up
  const onValidateBonus = React.useCallback(async () => {
    if (!popupKind) return;
    if (popupKind === 'CROIX')   return handleBonusValidateCroixLocal();
    if (popupKind === 'SCORE')   return handleBonusValidateScoreLocal();
    if (popupKind === 'SPECIAL') return handleBonusValidateSpeciauxLocal();
  }, [popupKind, handleBonusValidateCroixLocal, handleBonusValidateScoreLocal, handleBonusValidateSpeciauxLocal]);

// 6) Choix d'un match dans une pop-up Bonus
  function MatchDropdown({
    value,
    onChange,
    label = "Match",
    // si on MODIFIE un bonus, on autorise le match déjà utilisé
    allowCurrentId,
    // optionnel : exclure un match précis (RIBÉRY: exclure match_win dans le select match_zero)
    excludeId,
  }: {
    value: string;
    onChange: (v: string) => void;
    label?: string;
    allowCurrentId?: string | null;
    excludeId?: string | null;
  }) {
    return (
      <label className="block mb-3">
        {label}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 block w-full border rounded p-2"
        >
          <option value="">— Choisir match —</option>
          {matches
            .filter((m) => {
              const mid = String(m.id);
              const nsFree = isMatchSelectable(m); // NS, pas locké, pas déjà pris
              const isCurrent = allowCurrentId ? mid === String(allowCurrentId) : false;
              const notExcluded = excludeId ? mid !== String(excludeId) : true;
              return (nsFree || isCurrent) && notExcluded;
            })
            .map((m) => (
              <option key={m.id} value={String(m.id)}>
                {m.home_team} vs {m.away_team} – {m.base_1_points}/{m.base_n_points}/{m.base_2_points}
              </option>
            ))}
        </select>
      </label>
    );
  }

  // 7) Choix des picks dans une pop-up Bonus
  function PickDropdown({
    value, onChange, options,
    label = "Pronostic",
  }: {
    value: '1' | 'N' | '2';
    onChange: (v: '1' | 'N' | '2') => void;
    options: Array<'1' | 'N' | '2'>;
    label?: string;
  }) {
    return (
      <label className="block mb-6">
        {label}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as '1' | 'N' | '2')}
          className="mt-1 block w-full border rounded p-2"
        >
          {options.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>
    );
  }

  // 8) 6+7 pour affichage complet
  function renderPopupContent() {
    const code = openedBonus?.code as string | undefined;
    const existing = gridBonuses.find(gb => gb.bonus_definition === openedBonus?.id);
    const existingForOpened = gridBonuses.find(gb => gb.bonus_definition === openedBonus?.id);
    const currentMatchId = existingForOpened ? String(existingForOpened.match_id) : null;
    const currentZeroId = isRibery(openedBonus?.code)
      ? String(((existingForOpened?.parameters as RiberyParams | undefined)?.match_zero) ?? '')
      : null;
    if (!code) return null;

    // —— ZONE CROIX ——
    if (code === 'RIBERY') {
      return (
        <>
          <MatchDropdown
            label="Match à 3 croix"
            value={popupMatch1}
            onChange={setPopupMatch1}
            allowCurrentId={currentMatchId}
          />
          <MatchDropdown
            label="Match à 0 croix"
            value={popupMatch0}
            onChange={setPopupMatch0}
            allowCurrentId={currentZeroId}
            excludeId={popupMatch1}
          />
        </>
      );
    }
    if (code === 'KANTE') {
      return (
        <>
          <MatchDropdown value={popupMatch1} onChange={setPopupMatch1} allowCurrentId={currentMatchId}/>
          <label className="block mb-6">
            Paire de croix
            <select
              value={popupPair}
              onChange={(e) => setPopupPair(e.target.value as '1-N'|'N-2'|'1-2')}
              className="mt-1 block w-full border rounded p-2"
            >
              <option value="1-N">1 N</option>
              <option value="N-2">N 2</option>
              <option value="1-2">1 2</option>
            </select>
          </label>
        </>
      );
    }
    if (code === 'ZLATAN' || code === 'BIELSA') {
      return (
        <>
          <MatchDropdown value={popupMatch1} onChange={setPopupMatch1} allowCurrentId={currentMatchId}/>
          <PickDropdown value={popupPick} onChange={setPopupPick} options={['1','N','2']} />
        </>
      );
    }

    // —— ZONE SCORE ——
    if (code === 'BUTS') {
      return (
        <>
          <MatchDropdown value={popupMatch1} onChange={setPopupMatch1} allowCurrentId={currentMatchId}/>
          <PickDropdown value={popupPick} onChange={setPopupPick} options={['1', 'N', '2']}
          />
        </>
      );
    }

    if (code === 'ECART') {
      // Match + pick limité à 1 ou 2
      return (
        <>
          <MatchDropdown value={popupMatch1} onChange={setPopupMatch1} allowCurrentId={currentMatchId}/>
          <PickDropdown value={popupPick} onChange={setPopupPick} options={['1','2']} />
        </>
      );
    }
    if (code === 'CLEAN SHEET' || code === 'CLEAN_SHEET') {
      return (
        <>
          <MatchDropdown value={popupMatch1} onChange={setPopupMatch1} allowCurrentId={currentMatchId}/>
          <PickDropdown value={popupPick} onChange={setPopupPick} options={['1','N','2']} />
        </>
      );
    }

    // —— ZONE SPÉCIAUX (BOOSTS) ——
    if (code === 'BOOST_1' || code === 'BOOST_2' || code === 'BOOST_3') {
      return (
        <>
          <MatchDropdown value={popupMatch1} onChange={setPopupMatch1} allowCurrentId={currentMatchId}/>
          <PickDropdown value={popupPick} onChange={setPopupPick} options={['1','N','2']} />
        </>
      );
    }

    return null;
  }

// états d'ouverture des zones BONUS
const [openCroix, setOpenCroix] = useState(false);
const [openScore, setOpenScore] = useState(false);
const [openSpecial, setOpenSpecial] = useState(false);

// pour ne pas écraser un clic utilisateur pour zone bonus
const [touched, setTouched] = useState(false);

type InventoryRow = {
  user_id: string;
  competition_id: string;
  bonus_definition: string; // uuid de la définition
  quantity: number;
};

const [userInventory, setUserInventory] = useState<InventoryRow[]>([]);

useEffect(() => {
  if (!user?.id || !competition?.id) return;
  supabase
    .from('bonus_inventory')
    .select('user_id, competition_id, bonus_definition, quantity')
    .eq('user_id', user.id)
    .eq('competition_id', competition.id)
    .gt('quantity', 0)
    .then(({ data, error }) => setUserInventory(error ? [] : (data ?? [])));
}, [user?.id, competition?.id]);

const isPrivate = competition?.kind === 'PRIVATE';

// V1 : on ne sait pas encore récupérer proprement l'id du joueur ici.
// On met false pour l'instant, juste pour que le panneau fonctionne.
// On raffinera plus tard si tu veux afficher "toi 😉" de façon fiable.
const isCreator = false;


// cas spécial des bonus spéciaux
const specialsForUser = (defsSpecial ?? []).filter(def => userInventory.some(inv => inv.bonus_definition === def.id));
const specialsDefs = defsSpecial ?? [];

// auto-ouverture des zones bonus
const hasCroix   = (defsCroix?.length ?? 0) > 0;
const hasScore   = (defsScore?.length ?? 0) > 0;
const hasSpecial = (specialsForUser?.length ?? 0) > 0;
useEffect(() => {
  if (touched) return;           // ne pas écraser un clic utilisateur
  setOpenCroix(hasCroix);
  setOpenScore(hasScore);
  setOpenSpecial(hasSpecial);
}, [hasCroix, hasScore, hasSpecial, touched]);


  // 1) IDs pour le "gate"
  const userId = user?.id ?? null;
  const gridId = currentGrid?.id ? String(currentGrid.id) : null;

  // 2) Déduire le mode + variante image
const modeRaw = String(competition?.mode ?? '');
const mode: 'CLASSIC' | 'TOURNOI' = modeRaw.trim().toUpperCase() === 'TOURNOI' ? 'TOURNOI' : 'CLASSIC';

  const elimVariant = getElimVariant(competition?.name ?? '');

  // 6) Gate
  const gate = usePlayerGate(userId, competitionId, gridId || '', mode);

  let early: null | string = null;
  if (!competitionReady) early = 'COMPET_LOADING';
  else if (loadingGrids && grids.length === 0) early = 'GRIDS_LOADING';
  else if (!gridId) early = 'NO_GRID';
  else if (gate.state === 'loading') early = 'GATE_LOADING';

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

  // pour gérer l'affichage des cases 1N2 quand un bonus est joué.
  const { globalDisabled, byMatch } = React.useMemo(
    () => computeOverlay(bonusDefs, gridBonuses),
    [bonusDefs, gridBonuses]
  );

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

  // ouverture de la grille selon le status
  useEffect(() => {
  if (gate.state === 'joueur') {
    setOpenGrille(true);       // joueur → ouvert
  } else if (gate.state === 'elimine' || gate.state === 'spectateur') {
    setOpenGrille(false);      // éliminé / spectateur → fermé
  }
  // pour 'loading', on ne touche à rien, on garde la valeur actuelle
}, [gate.state]);

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

// pour savoir si une compétition donne des XP ou pas
const [xpEnabled, setXpEnabled] = useState(false);

useEffect(() => {
  if (!gridId) return;

  (async () => {
    // 1) récupérer competition_id depuis la grille
    const { data: g, error: gErr } = await supabase
      .from('grids')
      .select('competition_id')
      .eq('id', gridId)
      .single();

    if (gErr || !g?.competition_id) {
      setXpEnabled(false);
      return;
    }

    // 2) récupérer xp_enabled depuis la compétition
    const { data: c, error: cErr } = await supabase
      .from('competitions')
      .select('xp_enabled')
      .eq('id', g.competition_id)
      .single();

    if (cErr) {
      setXpEnabled(false);
      return;
    }

    setXpEnabled(Boolean(c?.xp_enabled));
  })();
}, [gridId, supabase]);




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

    const { data: { user }, error } = await supabase.auth.getUser();

    console.log('[AUTH] getUser()', {
      error,
      user_id: user?.id,
      email: user?.email,
      role: user?.role,
    });
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

        // 0) Fetch de la grille active
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

        // 1) Préparer la liste des match_id à récupérer
        const ids = (g.grid_items || []).map((x: { match_id: string }) => x.match_id);

        // 2) Fetch des matchs (côtes et scores)
        const { data: raws, error: re } = await supabase
          .from('matches')
          .select(`
            id,
            date,
            home_team,
            away_team,
            team_home_id,
            team_away_id,
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

        const matches = (raws ?? []) as any[];

        // 3) Fetch logos des équipes
        const teamIds = Array.from(
          new Set(matches.flatMap(m => [m.team_home_id, m.team_away_id]).filter(Boolean))
        );

        const { data: teams, error: te } = await supabase
          .from('teams')
          .select('id, logo')
          .in('id', teamIds);

        if (te) throw te;

        const logosMap: Record<number, string> = Object.fromEntries(
          (teams ?? []).map(t => [t.id, t.logo])
        );


        // 4) Fetch des picks posés dans grid_matches
        const { data: rawGridMatches, error: gmError } = await supabase
          .from('grid_matches')
          .select('id, match_id, pick, points')
          .eq('grid_id', gridId);
        if (gmError) throw gmError;

        // 5) Fusionner tout pour construire le tableau final
        const clean: any[] = (raws || []).map((m) => {
          const gm = rawGridMatches.find((gm) => gm.match_id === m.id);

          return {
            ...m,
            pick: gm?.pick ?? undefined,
            points: gm?.points ?? 0,
            home_logo: m.team_home_id ? logosMap[m.team_home_id] ?? null : null,
            away_logo: m.team_away_id ? logosMap[m.team_away_id] ?? null : null,
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
          .select('id, code, description, category_id,rule');
        if (be) throw be;
        // si Supabase ne déduit pas le type, on normalise
        setBonusDefs(
          (bd ?? []).map(d => ({
            id: d.id,
            code: d.code as BonusDef['code'],
            description: d.description,
            category_id: d.category_id,
            rule: d.rule,
          }))
        );

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

const hasBielsaAlready = codesPlayed.includes('BIELSA');
const hasAnyNotButs    = codesPlayed.some(c => c !== 'BUTS'); // couvre CROIX≠BIELSA, SCORE (ECART/CLEAN SHEET), SPECIAL (BOOST_x), etc.


function renderBonusRow(b: BonusDef) {
  // 1) États de base
  const isPlayed = gridBonuses.some(gb => gb.bonus_definition === b.id);

  // y a-t-il déjà un bonus dans **cette catégorie** ?
  const hasPlayedInCategory = gridBonuses.some(
    gb => bonusDefById[gb.bonus_definition]?.category_id === b.category_id
  );

  const isBielsa = b.code === 'BIELSA';

  // 2) Stock pour les BOOST_x (on regarde l'inventaire utilisateur)
  const hasStock =
    b.code.startsWith('BOOST_')
      ? userInventory.some(inv => inv.bonus_definition === b.id && (inv.quantity ?? 0) > 0)
      : true;

  // 3) Règles globales BIELSA (issues de ta logique existante)
  const canPlayBielsa = !hasBielsaAlready && !hasAnyNotButs;

  // 4) Peut-on afficher le bouton JOUER pour **ce** bonus ?
  const canPlayThis =
    !isPlayed &&                                  // pas déjà joué
    (!b.code.startsWith('BOOST_') || hasStock) && // BOOST: nécessite du stock
    (isBielsa ? canPlayBielsa : !hasPlayedInCategory); // règles BIELSA ou "un par catégorie"

  // 5) État verrouillé (match démarré ou verrouillé) pour l'affichage du bouton
  const bonusEntry  = gridBonuses.find(gb => gb.bonus_definition === b.id);
  const bonusMatch  = matches.find(m => m.id === bonusEntry?.match_id);
  const bonusLocked =
    !!bonusEntry &&
    (String(bonusMatch?.status ?? '').toUpperCase() !== 'NS' || !!bonusMatch?.is_locked);

  // 6) Rendu
  return (
    <div key={b.id} className="border rounded-lg p-3 bg-blue-50 flex items-center justify-between">
      <div className="flex items-center">
        <Image src={bonusLogos[b.code]} alt={b.code} width={40} height={40} className="rounded-full" />
        <div className="ml-3">
          <div className="text-lg font-bold text-green-600">{b.code}</div>
          <div className="text-sm">{b.description}</div>
        </div>
      </div>

      <div>
        {canPlayThis && (
          <button
            onClick={() => setOpenedBonus(b)}
            className="px-3 py-1 border rounded hover:bg-gray-100"
          >
            JOUER
          </button>
        )}

        {isPlayed && (
          bonusLocked ? (
            <div className="px-3 py-1 border rounded text-gray-500 flex items-center gap-2 cursor-not-allowed">
              <span>🔒</span><span>EN JEU</span>
            </div>
          ) : (
            <button
              onClick={() => setOpenedBonus(b)}
              className="px-3 py-1 border rounded hover:bg-gray-100"
            >
              MODIFIER
            </button>
          )
        )}
      </div>
    </div>
  );
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
   

// 🧨 Suppression d’un bonus (base via RPC + reload + reset UI)
const handleBonusDelete = async () => {
  if (!openedBonus || !user) return;

  // 🔍 La ligne grid_bonus à supprimer (celle du bonus ouvert)
  const placedBonus = gridBonuses.find(b => b.bonus_definition === openedBonus.id);
  if (!placedBonus) return;

  // ⏱ Sécurité horaire : on interdit la suppression trop proche du coup d’envoi
  const margin = 60 * 1000; // 60s
  const p = (placedBonus.parameters ?? {}) as any;

  // RIBERY a potentiellement 2 matchs (win/zero) à contrôler
  const matchIdsToCheck: string[] =
    openedBonus.code === 'RIBERY' && p.match_win && p.match_zero
      ? [p.match_win, p.match_zero]
      : [placedBonus.match_id];

  for (const matchId of matchIdsToCheck) {
    const m = matches.find(m => String(m.id) === String(matchId));
    if (!m || !('date' in m)) continue;
    const matchTime = new Date(m.date as any).getTime();
    if (Date.now() > matchTime - margin) {
      setShowOffside(true);
      return;
    }
  }

  try {
    // 1) Suppression atomique côté base (+1 rendu à l’inventaire si SPECIAL)
    const res = await supabase.rpc('revoke_bonus', {
      p_user_id: user.id,
      p_grid_bonus_id: placedBonus.id,
    });
    if (res.error) throw res.error;

    // 2) Rechargement propre des bonus de la grille
    const { data: gbs, error: gbe } = await supabase
      .from('grid_bonus')
      .select('id, grid_id, user_id, bonus_definition, match_id, parameters')
      .eq('grid_id', grid.id);

    if (gbe) throw gbe;
    setGridBonuses(gbs || []);

    // 3) Reset pop-up / états
    setOpenedBonus(null);
    setPopupMatch1('');
    setPopupMatch0('');
  } catch (e: any) {
    alert('Erreur suppression bonus : ' + (e?.message ?? String(e)));
  }
};

  // // 🧠 Aide bonus : savoir si un bonus a été joué, et lequel
  const isPlayed = gridBonuses.length>0;
  const playedBonusCode = bonusDefs.find(b=>b.id===gridBonuses[0]?.bonus_definition)?.code;

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

              {/* 5) INFOS COMPÉT (uniquement pour PRIVATE) */}
              {isPrivate && (
                <button
                  onClick={() => setViewAndURL('info')}
                  aria-pressed={view === 'info'}
                  className={`w-12 h-12 rounded-full border border-black bg-white p-[3px]
                              flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none
                              ${view === 'info' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
                  title="Infos de la compétition"
                >
                  <Image
                    src="/images/icons/info.png"
                    alt="Infos"
                    width={40}
                    height={40}
                    className="rounded-full object-cover"
                  />
                </button>
              )}
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

      {/* Vue des 2 classements et de la zone info */}
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
                    {xpEnabled && competition?.mode === 'CLASSIC' && (
                      <th className="text-left px-4 py-3">XP</th>
                    )}
                  </tr>
                </thead>
                <tbody>
{lbRows.map(row => {
  const me = row.user_id === user?.id;
  const xpClassic = Math.max(0, 11 - Number(row.rank || 0));

  return (
    <tr
      key={row.user_id}
      className={`border-t transition ${me ? 'bg-orange-100 font-bold' : 'hover:bg-gray-50'}`}
    >
      <td className="px-4 py-2">{row.rank}</td>
      <td className="px-4 py-2">{row.username}</td>
      <td className="px-4 py-2">{row.total_points}</td>

      {xpEnabled && competition?.mode === 'CLASSIC' && (
        <td className="px-4 py-2">{xpClassic}</td>
      )}
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

      {isPrivate && view === 'info' && (
        <div className="mt-4">
          <CompetitionInfoPanel
            name={competition.name}
            mode={competition.mode}
            kind={competition.kind}
            joinCode={competition.join_code}
            isCreator={isCreator}
          />
        </div>
      )}



      {/* 2) CONTENU PRINCIPAL : GRILLE (2/3) & BONUS (1/3) */}
      <div className={`flex flex-col lg:flex-row gap-6 ${view !== 'grid' ? 'hidden' : ''}`}>
        {/* ── GRILLE ── */}
        <div className="w-full lg:w-2/3">
          <div className="border rounded-lg">
    <button
      type="button"
      onClick={() => setOpenGrille(!openGrille)}
      className="w-full flex items-center px-4 py-3"
    >
      <span className="font-semibold text-center flex-1">
        {gate.state === 'joueur'
          ? "Fais tes pronos !"
          : gate.state === "elimine" || gate.state === "spectateur"
          ? "Suis la compet"
          : "Chargement..."}
      </span>
      <span className="text-xl shrink-0">
        {openGrille ? "▲" : "▼"}
      </span>
    </button>
                    {openGrille && (
                      <div className="-mx-4 px-4 pb-4 space-y-2">
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
                              //const matchWin = (params as Partial<{ match_win: string }>).match_win ?? '';
                              //const matchZero = (params as Partial<{ match_zero: string }>).match_zero ?? '';

                              // 1bis) Pour le bonus BIELSA
                              //const paramsPick = (params as { pick?: '1' | 'N' | '2' }).pick;
                              //const isBielsaActive = bonusCode === 'BIELSA' && !!bielsaMatchId;
                              //const isMutedByBielsa = isBielsaActive && m.id !== bielsaMatchId;
                              //const isBielsaThis   = isBielsaActive && m.id === bielsaMatchId;
                              //const isBielsaOther  = isBielsaActive && m.id !== bielsaMatchId;

            const overlay: OverlayEntry = byMatch[String(m.id)] ?? { disabled: false, picks: undefined, codes: [] };
            const entry = byMatch[String(m.id)];
            const disabledByOverlay = globalDisabled || Boolean(entry?.disabled);
            const picksFromOverlay = entry?.picks as ('1'|'N'|'2')[] | undefined;
            const codesHere = entry?.codes ?? [];
            const hasRiberyHere = codesHere.includes('RIBERY');
            const hasAnyBonusHere = codesHere.length > 0;
            const firstCode = hasRiberyHere ? 'RIBERY' : codesHere[0]; // un seul code par match, sauf RIBERY qui peut marquer 2 matchs

            // 2) Version unifiée basée sur l'overlay
            let picksForThisMatch: string[] = globalDisabled
              ? (picksFromOverlay ?? [])              // BIELSA actif → n’afficher des croix que si l’overlay en met (BIELSA)
              : (picksFromOverlay ?? (m.pick ? [m.pick] : []));  // cas normal → fallback sur le pick de la grille

            let isDisabled =
              disabledByOverlay ||                       // overlay (bonus posé / BIELSA global)
              upperStatus !== 'NS' ||                    // match démarré
              ['SUSP','INT','PST'].includes(upperStatus) ||
              !!m.is_locked ||                           // verrou interne
              isReadOnly;                                // spectateur / éliminé


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
            {/* Boutons 1/N/2 */}
            <div className="grid grid-cols-3 gap-[16px] justify-items-center">
              {(['1', 'N', '2'] as const).map((opt) => {
                const isX = picksForThisMatch.includes(opt);   // croix décidée par l’overlay
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
                                      {hasAnyBonusHere ? (
                                            <Image
                                              src={bonusLogos[firstCode]}
                                              alt={`${firstCode} bonus`}
                                              width={32}
                                              height={32}
                                              className="rounded-full"
                                            />
                                          ) : (
                                            <Image
                                              src={bonusLogos['INFO']}
                                              alt="bonus inconnu"
                                              width={32}
                                              height={32}
                                              className="rounded-full"
                                            />
                                          )}
                                        </button>
                                      </div>

                                  {/* LIGNE 2 */}
                                  {(() => {
                                    const { label, color } = getMatchLabelAndColor(m.status ?? '');
                                    const isNS = m.status === 'NS';

                                    return (
                                      <>
                                        <div className={`text-center text-xs ${color}`}>
                                          {label}
                                        </div>

                                        <div className="text-center font-semibold">
                                          {isNS ? (
                                            (m as any).home_logo ? (
                                              <img
                                                src={(m as any).home_logo}
                                                alt={m.home_team}
                                                className="w-5 h-5 mx-auto object-contain"
                                                loading="lazy"
                                              />
                                            ) : (
                                              ''
                                            )
                                          ) : (
                                            m.score_home ?? ''
                                          )}
                                        </div>

                                        <div className="grid grid-cols-3 gap-[16px] text-xs text-center justify-items-center mt-1">
                                          <div>{m.base_1_points ?? '-'}</div>
                                          <div>{m.base_n_points ?? '-'}</div>
                                          <div>{m.base_2_points ?? '-'}</div>
                                        </div>

                                        <div className="text-center font-semibold">
                                          {isNS ? (
                                            (m as any).away_logo ? (
                                              <img
                                                src={(m as any).away_logo}
                                                alt={m.away_team}
                                                className="w-5 h-5 mx-auto object-contain"
                                                loading="lazy"
                                              />
                                            ) : (
                                              ''
                                            )
                                          ) : (
                                            m.score_away ?? ''
                                          )}
                                        </div>

                                        <div className="text-center text-sm">
                                          {m.score_home != null ? `${m.points || 0} pts` : '? pts'}
                                        </div>
                                      </>
                                    );
                                  })()}

                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )}
          </div>
        </div>

        {/* ── BONUS ── */}
        <div className="w-full lg:w-1/3 space-y-4">
          {/* Gate sur le BONUS */}
          {gate.state !== 'joueur' ? (
            // Cas spectateur / éliminé : on affiche l'image
            <img
              src={
                gate.state === 'elimine'
                  ? ELIM_IMAGES[elimVariant]
                  : ELIM_IMAGES['spectateur']
              }
              alt={gate.state === 'elimine' ? 'Éliminé' : 'Spectateur'}
              className="w-full h-auto rounded-lg shadow-md"
            />
          ) : (
            <>
              {/* Accordéon CROIX */}
              <div className="border rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setTouched(true);
                    setOpenCroix(!openCroix);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3"
                >
                  <span className="font-semibold text-center w-full">
                    Joue ton bonus CROIX
                  </span>
                  <span className="text-xl">{openCroix ? "▲" : "▼"}</span>
                </button>
                {openCroix && (
                  <div className="px-4 pb-4 space-y-3">
                    {defsCroix.length === 0 ? (
                      <div className="text-sm text-gray-500">
                        Pas de bonus croix pour cette grille.
                      </div>
                    ) : (
                      defsCroix.map(renderBonusRow)
                    )}
                  </div>
                )}
              </div>

              {/* Accordéon SCORE */}
              <div className="border rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setTouched(true);
                    setOpenScore(!openScore);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3"
                >
                  <span className="font-semibold text-center w-full">
                    Joue ton bonus SCORE
                  </span>
                  <span className="text-xl">{openScore ? "▲" : "▼"}</span>
                </button>
                {openScore && (
                  <div className="px-4 pb-4 space-y-3">
                    {defsScore.length === 0 ? (
                      <div className="text-sm text-gray-500">
                        Pas de bonus score pour cette grille.
                      </div>
                    ) : (
                      defsScore.map(renderBonusRow)
                    )}
                  </div>
                )}
              </div>

              {/* Accordéon SPÉCIAUX */}
              <div className="border rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setTouched(true);
                    setOpenSpecial((v) => !v);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3"
                >
                  <span className="font-semibold text-center w-full">
                    Joue ton bonus SPÉCIAL
                  </span>
                  <span className="text-xl">{openSpecial ? "▲" : "▼"}</span>
                </button>

                {openSpecial && (
                  <div className="px-4 pb-4 space-y-3">
                    {specialsDefs.length === 0 ? (
                      <div className="text-sm text-gray-500">
                        Aucun bonus spécial défini.
                      </div>
                    ) : (
                      specialsDefs.map(renderBonusRow)
                    )}
                  </div>
                )}
              </div>
            </>
          )}
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
              {/* close */}
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
  
  /* --- DEBUG BONUS (à coller ici) --- */
const rawBonus = p?.bonus_code;
const normBonus = typeof rawBonus === 'string'
  ? rawBonus.trim().toUpperCase().replace(/\s+/g, '_')
  : rawBonus;

console.log('[popup] bonus for', p.username, {
  raw: JSON.stringify(rawBonus),
  norm: normBonus,
  has_bonus: !!p?.has_bonus,
  hit_raw: !!(rawBonus && bonusLogos[rawBonus as string]),
  hit_norm: !!(normBonus && bonusLogos[normBonus as string]),
});
/* --- /DEBUG BONUS --- */

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
                console.log('[popup] bonusLogos keys:', Object.keys(bonusLogos));


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

      {/* Titre centré */}
      <h2 className="text-2xl font-bold mb-2 text-center">
        {openedBonus.code}
      </h2>

      {/* Texte justifié */}
      <p className="mb-4 text-sm text-gray-700 text-justify">
        {openedBonus.rule ?? openedBonus.description}
      </p>

      {renderPopupContent()}

      {/* Boutons */}
      {(() => {
        const hasDelete = gridBonuses.some(
          (b) => b.bonus_definition === openedBonus.id
        );
        return (
          <div className={`mt-4 flex ${hasDelete ? "justify-between" : "justify-center"}`}>
            {/* Vert toujours rendu en premier */}
            <button
              onClick={onValidateBonus}
              className="px-4 py-2 bg-green-500 text-white rounded"
            >
              Valider
            </button>

            {/* Rouge seulement si présent */}
            {hasDelete && (
              <button
                onClick={handleBonusDelete}
                className="px-4 py-2 bg-red-500 text-white rounded"
              >
                Supprimer
              </button>
            )}
          </div>
        );
      })()}
    </div>
  </div>
)}
     
      </div>
    </main>
    </>
  );
}
