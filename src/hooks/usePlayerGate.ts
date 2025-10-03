'use client';

import { useEffect, useState } from 'react';
import createClient from '../lib/supabaseBrowser'; // export défaut = instance

type GateState = 'loading' | 'elimine' | 'spectateur' | 'joueur';
type Result = { state: GateState; reason?: string };

export function usePlayerGate(
  userId: string | null,
  competitionId: string,
  gridId: string,
  mode: 'CLASSIC' | 'TOURNOI'
): Result {
  const [res, setRes] = useState<Result>({ state: 'loading' });
  const supabase = createClient; // <-- pas d'appel ()

useEffect(() => {
  console.log('[gate] LIVE v6'); // trace version

  let alive = true;
  (async () => {
    try {
      console.log('[gate] start', { userId, competitionId, gridId, mode });

      // --- GARDES DE BASE ----------------------------------------------------
      if (!competitionId || !gridId) {
        setRes({ state: 'loading', reason: 'NO_IDS' });
        return;
      }

      // --- MODE CLASSIC : toujours ouvert -----------------------------------
      // connecté => joueur ; non connecté => spectateur. Pas de RPC ici.
      if (mode === 'CLASSIC') {
      const out: Result = userId
          ? { state: 'joueur', reason: 'CLASSIC_OPEN' }
          : { state: 'spectateur', reason: 'NO_USER' };

      setRes(out);
      console.log('[gate] classic ->', out.state);
      return;
      }

      // --- MODE TOURNOI : nécessite user ------------------------------------
      if (!userId) { setRes({ state: 'spectateur', reason: 'NO_USER' }); return; }

      // --- 1) Autorisation générale (RPC + fallback table) ------------------
    let allowed = true;
    {
      const { count, error } = await supabase
        .from('grid_player_eligibility')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', competitionId)
        .eq('user_id', userId);

      if (error) {
        // en cas d’erreur DB: prudence → spectateur
        setRes({ state: 'spectateur', reason: 'ELIG_ERR' });
        return;
      }
      allowed = (count ?? 0) === 0; // autorisé si PAS dans la table
    }
    
    if (!allowed) { setRes({ state: 'elimine', reason: 'ELIM' }); return; }

      // --- 1bis) A-t-il déjà joué la GRILLE COURANTE ? ----------------------
      // ⚠️ Ne compter que les VRAIS picks (pick NOT NULL). Bonus : toute ligne suffit.
    const { count: thisPickCount, error: thisPickErr } = await supabase
    .from('grid_matches')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('grid_id', gridId)
    .not('pick', 'is', null);
    if (thisPickErr) console.warn('[gate:T] thisPick ERR', thisPickErr);

    const { count: thisBonusCount, error: thisBonusErr } = await supabase
    .from('grid_bonus')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('grid_id', gridId);
    if (thisBonusErr) console.warn('[gate:T] thisBonus ERR', thisBonusErr);

    const hasPlayedThisGrid = (thisPickCount ?? 0) > 0 || (thisBonusCount ?? 0) > 0;
    console.log('[gate:T] thisGrid=', { thisPickCount, thisBonusCount, hasPlayedThisGrid });

    if (hasPlayedThisGrid) { 
    setRes({ state: 'joueur', reason: 'ALREADY_THIS_GRID' }); 
    return; 
    }

    // 2) Récupérer les AUTRES grilles de la compétition via le mapping
    const { data: cg, error: cgErr } = await supabase
    .from('competition_grids')
    .select('grid_id')
    .eq('competition_id', competitionId)
    .neq('grid_id', gridId);

    if (cgErr) { console.warn('[gate:T] CG_ERR', cgErr); setRes({ state: 'spectateur', reason: 'GRIDS_ERR' }); return; }

    const otherGridIds = (cg ?? []).map((r: any) => r.grid_id);
    console.log('[gate:T] otherGridIds', otherGridIds.length);

    // 2bis) Parmi ces autres grilles, y a-t-il au moins UNE publiée ? (via join)
    let publishedCount = 0;
    if (otherGridIds.length > 0) {
    try {
        const { data: pubRows, error: pubErr } = await supabase
        .from('grids')
        .select('id')           // 👈 pas d'accès à is_published
        .in('id', otherGridIds);

        if (pubErr) throw pubErr;
        publishedCount = (pubRows ?? []).length;
        console.log('[gate:T] publishedCount(any)=', publishedCount);
    } catch (e) {
        console.warn('[gate:T] PUB_FALLBACK_ERR', e);
        // dernier recours : on prend le nombre d'autres grilles mappées
        publishedCount = otherGridIds.length;
        console.log('[gate:T] publishedCount(fallback)=', publishedCount);
    }
    }

    // Si aucune autre grille publiée → il peut démarrer
    if (publishedCount === 0) { setRes({ state: 'joueur', reason: 'FIRST_GRID' }); return; }
    console.log('[gate:T] go 3');

    // 3) A déjà participé sur une AUTRE grille ? (ne compter que les vrais picks)
    
    const { count: pickCount } = await supabase
    .from('grid_matches')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('grid_id', otherGridIds)
    .not('pick', 'is', null);

    const { count: bonusCount } = await supabase
    .from('grid_bonus')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('grid_id', otherGridIds);

    const hasParticipated = (pickCount ?? 0) > 0 || (bonusCount ?? 0) > 0;
    console.log('[gate:T] participated other=', { pickCount, bonusCount, hasParticipated });

    setRes(hasParticipated
      ? { state: 'joueur', reason: 'STARTED_OTHER_GRID' }   // ⬅️ au lieu de undefined
      : { state: 'spectateur', reason: 'NEVER_STARTED' });
    return;

    } catch (e) {
      console.error('[gate] CRASH', e);
      if (alive) setRes({ state: 'spectateur', reason: 'GATE_CRASH' });
    }
  })();

  return () => { alive = false; };
}, [userId, competitionId, gridId, mode]);



  return res;
}
