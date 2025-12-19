// src/app/api/push/cron/route.ts
export const runtime = 'nodejs';
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { messaging } from '../../../../lib/firebaseAdmin';

const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const MATCH_STATUS_NOT_STARTED = 'NS';
const MATCH_STATUS_FINISHED = 'FT';
const WINDOW_MINUTES = 10; // fenêtre anti-doublons [NOW +ou- window/2]
type Kind = 'H24' | 'H1' | 'GRID_DONE';
const BIELSA_BONUS_DEFINITION_ID = 'cee1eccc-28bf-4cbf-9968-2e7479d3b19f';

// ordre de priorité d’envoi par plateforme
const PLATFORM_PRIORITY = ['twa', 'android', 'web', 'ios'] as const;

// gestion du cas des éliminés en tournoi qui ne doivent pas recevoir de rappel
type EligRow = { user_id: string; competition_id: string; can_play: boolean | null };

async function loadEliminatedSet(compIds: string[], supabase: any) {
  if (!compIds.length) return new Set<string>();
  const { data, error } = await supabase
    .from('grid_player_eligibility')
    .select('user_id, competition_id, can_play')
    .in('competition_id', compIds);
  if (error) throw new Error(error.message);

  // On considère “éliminé” uniquement si can_play === false
  const set = new Set<string>();
  for (const r of (data || []) as EligRow[]) {
    if (r.can_play === false) set.add(`${r.user_id}|${r.competition_id}`);
  }
  return set;
}


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get('type') || '').toUpperCase() as Kind;
  const only = searchParams.get('only') || null;

  if (!['H24', 'H1', 'GRID_DONE'].includes(type)) {
    return new Response(JSON.stringify({ ok: false, error: 'type must be H24|H1|GRID_DONE' }), { status: 400 });
  }

  try {
    if (type === 'GRID_DONE') {
      const count = await handleGridDone();
      return Response.json({ ok: true, type, sent: count });
    } else {
      const count = await handleMatchReminder(type, only);
      return Response.json({ ok: true, type, sent: count });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'unknown' }), { status: 500 });
  }
}

/**
 * Rappels J-1 / H-1 — n’envoie que :
 * - aux joueurs SANS pick sur le match
 * - qui ont déjà “joué” dans la compétition (au moins une croix OU un bonus)
 * - et qui n’ont pas désactivé la préférence correspondante
 * - en priorisant l’appli (twa/android) sur le web/ios
 */
async function handleMatchReminder(kind: 'H24' | 'H1', only: string | null) {
  const now = new Date();
  const deltaMinutes = kind === 'H24' ? 24 * 60 : 60; // 24*60 en prod pour J-1

  // 🔁 fenêtre centrée autour de H-1 / J-1
  const target = new Date(now.getTime() + deltaMinutes * 60 * 1000); // heure "théorique" du match
  const halfWindowMs = (WINDOW_MINUTES / 2) * 60 * 1000;
  const start = new Date(target.getTime() - halfWindowMs);
  const end   = new Date(target.getTime() + halfWindowMs);

  // 1) Matches dans la fenêtre et encore NS
  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select('id, date, status')
    .gte('date', start.toISOString())
    .lt('date', end.toISOString())
    .eq('status', MATCH_STATUS_NOT_STARTED);
  if (mErr) throw new Error(mErr.message);
  if (!matches?.length) return 0;

  const matchIds = matches.map((m) => m.id);

  // 2) grid_matches pour ces matches
  const { data: gms, error: gmErr } = await supabase
    .from('grid_matches')
    .select('user_id, match_id, grid_id, competition_id, pick')
    .in('match_id', matchIds);
  if (gmErr) throw new Error(gmErr.message);
  if (!gms?.length) return 0;

  // Users sans pick pour chaque match
  const todoByMatch = new Map<number, Set<string>>();
  const allTodoUsers = new Set<string>();

  const compByMatch = new Map<number, string | number>();
  const gridByUserMatch = new Map<string, string | number>();

  for (const r of gms) {
    // On ignore toute ligne sans competition_id :
    // - on ne sait pas sur quelle compet appliquer prefs / éligibilité
    // - cela évite le bug "tournoi" où la compet est NULL
    if (r.competition_id == null) {
      continue;
    }

    // pas de pick => candidat au rappel
    if (r.pick == null) {
      if (!todoByMatch.has(r.match_id)) todoByMatch.set(r.match_id, new Set());
      todoByMatch.get(r.match_id)!.add(r.user_id);
      allTodoUsers.add(r.user_id);
    }

    // map match -> compet (une seule compet par match dans ce contexte)
    if (!compByMatch.has(r.match_id)) {
      compByMatch.set(r.match_id, r.competition_id);
    }

    // map (user, match) -> grid (utilisé pour BIELSA et autres bonus grille)
    gridByUserMatch.set(`${r.user_id}|${r.match_id}`, r.grid_id);
  }


  if (!todoByMatch.size) return 0;

  const allTodoUserIds = Array.from(allTodoUsers);
  if (!allTodoUserIds.length) return 0;

  // 3) Préférences ON (par défaut ON si pas de ligne)
  type PrefRow = {
    user_id: string;
    allow_match_reminder_24h: boolean | null;
    allow_match_reminder_1h:  boolean | null;
  };

  const { data: prefsRaw, error: prefErr } = await supabase
    .from('push_prefs')
    .select('user_id, allow_match_reminder_24h, allow_match_reminder_1h')
    .in('user_id', allTodoUserIds);
  if (prefErr) throw new Error(prefErr.message);

  const offSet = new Set<string>(
    (prefsRaw || [])
      .filter((r: PrefRow) =>
        kind === 'H24'
          ? r.allow_match_reminder_24h === false
          : r.allow_match_reminder_1h === false
      )
      .map((r: PrefRow) => r.user_id)
  );

  // 4) Compétitions impliquées
  const compIds: string[] = Array.from(
    new Set(
      (gms || [])
        .map((r) => r.competition_id)
        .filter((v): v is string => typeof v === 'string' && v !== null)
    )
  );

  // joueurs éliminés par compet
  const eliminatedByComp = await loadEliminatedSet(compIds, supabase);

  // (A) Engagement via CROIX
  const { data: played, error: playedErr } = await supabase
    .from('grid_matches')
    .select('user_id, competition_id')
    .in('competition_id', compIds)
    .not('pick', 'is', null);
  if (playedErr) throw new Error(playedErr.message);

  // (B) Engagement via BONUS (et détection bonus sur match / BIELSA)
  const { data: gridsMap, error: gridsErr } = await supabase
    .from('grids')
    .select('id, competition_id')
    .in('competition_id', compIds);
  if (gridsErr) throw new Error(gridsErr.message);

  const compByGrid = new Map<string | number, string | number>();
  for (const g of gridsMap || []) compByGrid.set(g.id, g.competition_id);

  const gridIds = Array.from(compByGrid.keys());

  // Set "user_id|competition_id" des joueurs engagés (croix OU bonus)
  const engagedSet = new Set<string>();

  // engagement via CROIX
  for (const r of (played || []) as { user_id: string; competition_id: string }[]) {
    engagedSet.add(`${r.user_id}|${r.competition_id}`);
  }

  // BONUS : utilisé pour engagement + exclusion (bonus sur le match / BIELSA sur la grille)
  type BonusRow = {
    user_id: string;
    grid_id: string | number;
    match_id: number | null;
    bonus_definition: string;   // uuid vers bonus_definition
    parameters: any | null;     // jsonb
  };

  const bonusOnMatch = new Set<string>(); // "uid|match_id" => bonus déjà joué sur CE match
  const bielsaOnGrid = new Set<string>(); // "uid|grid_id" => BIELSA joué sur cette grille

  if (gridIds.length) {
    const { data: bonusRows, error: bonusErr } = await supabase
      .from('grid_bonus')
      .select('user_id, grid_id, match_id, bonus_definition, parameters')
      .in('grid_id', gridIds);
    if (bonusErr) throw new Error(bonusErr.message);

    for (const b of (bonusRows || []) as BonusRow[]) {
      const cid = compByGrid.get(b.grid_id);
      if (cid != null) {
        // engagement via bonus (inchangé)
        engagedSet.add(`${b.user_id}|${cid}`);
      }

      // (1) bonus ciblé sur un match => pas de rappel pour ce match
      if (b.match_id != null) {
        bonusOnMatch.add(`${b.user_id}|${b.match_id}`);
      }

      // 🔁 NOUVEAU : gérer le cas RIBERY avec match_zero / match_win dans parameters
      if (b.parameters && typeof b.parameters === 'object') {
        const params = b.parameters as any;
        const extraMatchIds: Array<number | string> = [];

        if (params.match_zero != null) extraMatchIds.push(params.match_zero);
        if (params.match_win  != null) extraMatchIds.push(params.match_win);

        for (const mid of extraMatchIds) {
          bonusOnMatch.add(`${b.user_id}|${mid}`);
        }
      }

      // (2) BIELSA sur la grille => pas de rappel pour cette grille
      if (b.bonus_definition === BIELSA_BONUS_DEFINITION_ID) {
        bielsaOnGrid.add(`${b.user_id}|${b.grid_id}`);
      }
    }
  }


  // 5) Tokens (priorité plateforme) + filtre only
  let tokensQuery = supabase
    .from('push_tokens')
    .select('token, user_id, platform, last_seen_at')
    .order('last_seen_at', { ascending: false, nullsFirst: false });

  if (only) {
    tokensQuery = tokensQuery.eq('user_id', only);
  } else {
    tokensQuery = tokensQuery.in('user_id', allTodoUserIds);
  }

  const { data: tokensRows, error: tErr } = await tokensQuery;
  if (tErr) throw new Error(tErr.message);

  function pickPreferredTokensForUser(uid: string): string[] {
    const rows = (tokensRows || []).filter((r: any) => r.user_id === uid);
    for (const p of PLATFORM_PRIORITY) {
      const subset = rows.filter((r: any) => (r.platform as any) === p);
      if (subset.length) return [subset[0].token as string];
    }
    return [];
  }

  // 6) Envoi
  let sentCount = 0;
  const toDelete = new Set<string>();

  for (const m of matches) {
    const users = todoByMatch.get(m.id);
    if (!users?.size) continue;

    const compId = compByMatch.get(m.id);

    const eligible = Array.from(users).filter((uid) => {
      if (!compId) return false;
      if (only && uid !== only) return false; // test ciblé

      // (1) bonus déjà joué sur CE match => pas de rappel
      if (bonusOnMatch.has(`${uid}|${m.id}`)) {
        return false;
      }

      // (2) BIELSA joué sur la grille de (uid, match) => pas de rappel
      const gid = gridByUserMatch.get(`${uid}|${m.id}`);
      if (gid && bielsaOnGrid.has(`${uid}|${gid}`)) {
        return false;
      }

      const engaged = engagedSet.has(`${uid}|${compId}`);
      const notEliminated = !eliminatedByComp.has(`${uid}|${compId}`);
      const prefOK = !offSet.has(uid);

      return engaged && notEliminated && prefOK;
    });

    if (!eligible.length) continue;
    console.log('[CRON] match', m.id, 'eligible users:', eligible);

    for (const uid of eligible) {
      const userTokens = pickPreferredTokensForUser(uid);
      if (!userTokens.length) continue; // pas de device connu → inutile de logger
      console.log('[CRON] sending reminder', kind, 'to uid', uid, 'tokens:', userTokens);

      // dédup via push_log (uniquement si on a un token)
      const ins = await supabase
        .from('push_log')
        .insert({ user_id: uid, kind, match_id: m.id, grid_id: null });
      if (ins.error) {
        const code = (ins.error as any).code || '';
        if (code === '23505') continue; // déjà envoyé
        continue;
      }

      await Promise.all(
        userTokens.map(async (t) => {
          try {
            await messaging.send({
              token: t,
              webpush: {
                headers: { Urgency: 'high', TTL: '10' },
                data: {
                  title: kind === 'H24' ? '⏰ Rappel J-1' : '⏰ Rappel H-1',
                  body:  'Tu as des matchs non pariés qui démarrent bientôt.',
                  url:   'https://www.peps-foot.com/',
                  icon:  '/images/notifications/peps-notif-icon-192.png',
                  tag:   'peps-reminder',
                },
                fcmOptions: { link: 'https://www.peps-foot.com/' },
              },
            });
            sentCount++;
          } catch (e: any) {
            const msg = e?.errorInfo?.code || e?.message || '';
            if (
              String(msg).includes('registration-token-not-registered') ||
              String(msg).includes('invalid-argument')
            ) {
              toDelete.add(t);
            }
          }
        })
      );
    }
  }

  if (toDelete.size) {
    await supabase.from('push_tokens').delete().in('token', Array.from(toDelete));
  }
  return sentCount;
}

/**
 * Grille terminée — notifie les participants (préférence ON),
 * en priorisant aussi l’appli.
 */
async function handleGridDone() {
  // 1) Grilles non terminées
  const { data: grids, error: gErr } = await supabase
    .from('grids')
    .select('id, competition_id')
    .eq('grid_done', false);

  if (gErr) throw new Error(gErr.message);
  if (!grids?.length) return 0;

  const gridIds = grids.map((g) => String(g.id));

  // Map grille -> compet
  const gridToComp = new Map<string, string>();
  for (const g of grids) {
    if (g.competition_id) gridToComp.set(String(g.id), String(g.competition_id));
  }

  // 2) Charger la composition des grilles via grid_items
  const { data: items, error: itErr } = await supabase
    .from('grid_items')
    .select('grid_id, match_id')
    .in('grid_id', gridIds);

  if (itErr) throw new Error(itErr.message);
  if (!items?.length) return 0;

  // regrouper match_ids par grid_id
  const matchIdsByGrid = new Map<string, string[]>();
  const allMatchIdsSet = new Set<string>();

  for (const it of items) {
    const gid = String(it.grid_id);
    const mid = String(it.match_id);

    if (!matchIdsByGrid.has(gid)) matchIdsByGrid.set(gid, []);
    matchIdsByGrid.get(gid)!.push(mid);

    allMatchIdsSet.add(mid);
  }

  const allMatchIds = Array.from(allMatchIdsSet);
  if (!allMatchIds.length) return 0;

  // 3) Charger les statuts des matchs concernés
  const { data: mRows, error: mErr } = await supabase
    .from('matches')
    .select('id, status')
    .in('id', allMatchIds);

  if (mErr) throw new Error(mErr.message);

  const statusByMatch = new Map<string, string>(
    (mRows || []).map((m) => [String(m.id), String(m.status)])
  );

  // FT only (comme tu veux)
  const isFT = (s: any) => String(s || '').trim().toUpperCase() === 'FT';

  // 4) Déterminer les grilles terminées
  const finishedGrids = new Set<string>();

  for (const gid of gridIds) {
    const mids = matchIdsByGrid.get(gid) || [];
    if (!mids.length) continue;

    const allFinished = mids.every((mid) => isFT(statusByMatch.get(mid)));
    if (allFinished) finishedGrids.add(gid);
  }

  if (!finishedGrids.size) return 0;

  // 5) Marquer grid_done = true (avec check d'erreur !)
  const { error: updErr } = await supabase
    .from('grids')
    .update({ grid_done: true })
    .in('id', Array.from(finishedGrids));

  if (updErr) throw new Error(updErr.message);

  // 6) Participants (users liés à ces grilles) via grid_matches
  // -> et uniquement ceux-là recevront une notif
  const { data: participants, error: partErr } = await supabase
    .from('grid_matches')
    .select('grid_id, user_id')
    .in('grid_id', Array.from(finishedGrids));

  if (partErr) throw new Error(partErr.message);

  const usersByGrid = new Map<string, Set<string>>();
  for (const r of participants || []) {
    const gid = String(r.grid_id);
    const uid = String(r.user_id);
    if (!usersByGrid.has(gid)) usersByGrid.set(gid, new Set());
    usersByGrid.get(gid)!.add(uid);
  }

  // 7) Préférences allow_grid_done
  const { data: prefs, error: prefErr } = await supabase
    .from('push_prefs')
    .select('user_id, allow_grid_done');

  if (prefErr) throw new Error(prefErr.message);

  const offSet = new Set(
    (prefs || [])
      .filter((r) => r.allow_grid_done === false)
      .map((r) => String(r.user_id))
  );

  // éliminés sur les compétitions concernées
  const compIdsGD = Array.from(
    new Set(
      (grids || [])
        .map((g) => g.competition_id)
        .filter((v): v is string => typeof v === 'string' && v !== null)
        .map(String)
    )
  );
  const eliminatedByComp = await loadEliminatedSet(compIdsGD, supabase);

  // 8) Tokens
  const { data: tokensRows, error: tErr } = await supabase
    .from('push_tokens')
    .select('token, user_id, platform');

  if (tErr) throw new Error(tErr.message);

  function pickPreferredTokensForUser(uid: string): string[] {
    const rows = (tokensRows || []).filter((t) => String(t.user_id) === uid);
    for (const p of PLATFORM_PRIORITY) {
      const subset = rows
        .filter((r) => (r.platform as any) === p)
        .map((r) => String(r.token));
      if (subset.length) return subset;
    }
    return [];
  }

  // 9) Envoi
  let sentCount = 0;
  const toDelete = new Set<string>();

  for (const gridId of Array.from(finishedGrids)) {
    const compId = gridToComp.get(gridId);
    if (!compId) continue;

    const users = Array.from(usersByGrid.get(gridId) || []).filter((uid) => {
      const eliminated = eliminatedByComp.has(`${uid}|${compId}`);
      return !offSet.has(uid) && !eliminated;
    });

    for (const uid of users) {
      // dédup via push_log
      const { error: logErr } = await supabase
        .from('push_log')
        .upsert(
          { user_id: uid, kind: 'GRID_DONE', match_id: null, grid_id: gridId },
          { onConflict: 'user_id,kind,match_id,grid_id' }
        );
      if (logErr) continue;

      const userTokens = pickPreferredTokensForUser(uid);
      if (!userTokens.length) continue;

      await Promise.all(
        userTokens.map(async (t) => {
          try {
            await messaging.send({
              token: t,
              webpush: {
                headers: { Urgency: 'high', TTL: '10' },
                data: {
                  title: '🎉 Grille terminée',
                  body: 'Les résultats sont là. Viens voir ton score !',
                  url: 'https://www.peps-foot.com/',
                  icon: '/icon-512x512.png',
                  tag: 'peps-grid-done',
                },
                fcmOptions: { link: 'https://www.peps-foot.com/' },
              },
            });
            sentCount++;
          } catch (e: any) {
            const msg = e?.errorInfo?.code || e?.message || '';
            if (
              String(msg).includes('registration-token-not-registered') ||
              String(msg).includes('invalid-argument')
            ) {
              toDelete.add(t);
            }
          }
        })
      );
    }
  }

  if (toDelete.size) {
    await supabase.from('push_tokens').delete().in('token', Array.from(toDelete));
  }

  return sentCount;
}

