// pour envoyer des notifs H-1 et J-1
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
  const deltaMinutes = kind === 'H24' ? 24 * 60 : 60;

  // fenêtre centrée autour de H-1 / J-1
  const target = new Date(now.getTime() + deltaMinutes * 60 * 1000);
  const halfWindowMs = (WINDOW_MINUTES / 2) * 60 * 1000;
  const start = new Date(target.getTime() - halfWindowMs);
  const end = new Date(target.getTime() + halfWindowMs);

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

  // Clé = match_id + competition_id
  const todoByMatchComp = new Map<string, Set<string>>();
  const gridByUserMatchComp = new Map<string, string>();
  const allTodoUsers = new Set<string>();
  const compIdsSet = new Set<string>();

  for (const r of gms) {
    if (!r.competition_id) continue;

    const compId = String(r.competition_id);
    const matchId = String(r.match_id);
    const gridId = String(r.grid_id);
    const key = `${matchId}|${compId}`;
    const userMatchCompKey = `${r.user_id}|${matchId}|${compId}`;

    compIdsSet.add(compId);

    if (r.pick == null) {
      if (!todoByMatchComp.has(key)) {
        todoByMatchComp.set(key, new Set());
      }
      todoByMatchComp.get(key)!.add(String(r.user_id));
      allTodoUsers.add(String(r.user_id));
    }

    gridByUserMatchComp.set(userMatchCompKey, gridId);
  }

  if (!todoByMatchComp.size) return 0;

  const allTodoUserIds = Array.from(allTodoUsers);
  if (!allTodoUserIds.length) return 0;

  const compIds = Array.from(compIdsSet);
  if (!compIds.length) return 0;

  // 3) Préférences ON (par défaut ON si pas de ligne)
  type PrefRow = {
    user_id: string;
    allow_match_reminder_24h: boolean | null;
    allow_match_reminder_1h: boolean | null;
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
      .map((r: PrefRow) => String(r.user_id))
  );

  // 4) Joueurs éliminés par compétition
  const eliminatedByComp = await loadEliminatedSet(compIds, supabase);

  // 5) Engagement via CROIX
  const { data: played, error: playedErr } = await supabase
    .from('grid_matches')
    .select('user_id, competition_id')
    .in('competition_id', compIds)
    .not('pick', 'is', null);

  if (playedErr) throw new Error(playedErr.message);

  // 6) Chargement des grilles pour relier bonus -> competition_id
  const { data: gridsMap, error: gridsErr } = await supabase
    .from('grids')
    .select('id, competition_id')
    .in('competition_id', compIds);

  if (gridsErr) throw new Error(gridsErr.message);

  const compByGrid = new Map<string, string>();
  for (const g of gridsMap || []) {
    if (g.id && g.competition_id) {
      compByGrid.set(String(g.id), String(g.competition_id));
    }
  }

  const gridIds = Array.from(compByGrid.keys());

  // Set "user_id|competition_id" des joueurs engagés (croix OU bonus)
  const engagedSet = new Set<string>();

  for (const r of (played || []) as { user_id: string; competition_id: string }[]) {
    if (r.user_id && r.competition_id) {
      engagedSet.add(`${r.user_id}|${r.competition_id}`);
    }
  }

  type BonusRow = {
    user_id: string;
    grid_id: string;
    match_id: string | null;
    bonus_definition: string;
    parameters: any | null;
  };

  const bonusOnMatchComp = new Set<string>(); // "uid|match_id|competition_id"
  const bielsaOnGrid = new Set<string>(); // "uid|grid_id"

  if (gridIds.length) {
    const { data: bonusRows, error: bonusErr } = await supabase
      .from('grid_bonus')
      .select('user_id, grid_id, match_id, bonus_definition, parameters')
      .in('grid_id', gridIds);

    if (bonusErr) throw new Error(bonusErr.message);

    for (const b of (bonusRows || []) as BonusRow[]) {
      const gridId = String(b.grid_id);
      const cid = compByGrid.get(gridId);

      if (cid) {
        engagedSet.add(`${b.user_id}|${cid}`);
      }

      if (cid && b.match_id != null) {
        bonusOnMatchComp.add(`${b.user_id}|${String(b.match_id)}|${cid}`);
      }

      if (cid && b.parameters && typeof b.parameters === 'object') {
        const params = b.parameters as any;
        const extraMatchIds: Array<string | number> = [];

        if (params.match_zero != null) extraMatchIds.push(params.match_zero);
        if (params.match_win != null) extraMatchIds.push(params.match_win);

        for (const mid of extraMatchIds) {
          bonusOnMatchComp.add(`${b.user_id}|${String(mid)}|${cid}`);
        }
      }

      if (b.bonus_definition === BIELSA_BONUS_DEFINITION_ID) {
        bielsaOnGrid.add(`${b.user_id}|${gridId}`);
      }
    }
  }

  // 7) Tokens
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
    const rows = (tokensRows || []).filter((r: any) => String(r.user_id) === uid);
    for (const p of PLATFORM_PRIORITY) {
      const subset = rows.filter((r: any) => (r.platform as any) === p);
      if (subset.length) return [String(subset[0].token)];
    }
    return [];
  }

  // 8) Envoi
  let sentCount = 0;
  const toDelete = new Set<string>();

  for (const [matchCompKey, users] of todoByMatchComp.entries()) {
    if (!users?.size) continue;

    const [matchId, compId] = matchCompKey.split('|');
    if (!matchId || !compId) continue;

    const eligible = Array.from(users).filter((uid) => {
      if (only && uid !== only) return false;

      // bonus déjà joué sur CE match dans CETTE compétition
      if (bonusOnMatchComp.has(`${uid}|${matchId}|${compId}`)) {
        return false;
      }

      // BIELSA déjà joué sur la grille correspondante
      const gid = gridByUserMatchComp.get(`${uid}|${matchId}|${compId}`);
      if (gid && bielsaOnGrid.has(`${uid}|${gid}`)) {
        return false;
      }

      const engaged = engagedSet.has(`${uid}|${compId}`);
      const notEliminated = !eliminatedByComp.has(`${uid}|${compId}`);
      const prefOK = !offSet.has(uid);

      return engaged && notEliminated && prefOK;
    });

    if (!eligible.length) continue;
    console.log('[CRON] match/comp', matchCompKey, 'eligible users:', eligible);

    for (const uid of eligible) {
      const userTokens = pickPreferredTokensForUser(uid);
      if (!userTokens.length) continue;

      console.log('[CRON] sending reminder', kind, 'to uid', uid, 'match', matchId, 'comp', compId, 'tokens:', userTokens);

      const ins = await supabase
        .from('push_log')
        .insert({ user_id: uid, kind, match_id: matchId, grid_id: null });

      if (ins.error) {
        const code = (ins.error as any).code || '';
        if (code === '23505') continue;
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
                  body: 'Tu as des matchs non pariés qui démarrent bientôt.',
                  url: 'https://www.peps-foot.com/',
                  icon: '/images/notifications/peps-notif-icon-192.png',
                  tag: 'peps-reminder',
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
  // ===== DEBUG =====
  const DEBUG = true; // mets false après tests
  const runId = `GRID_DONE_${new Date().toISOString()}`;
  const log = (...args: any[]) => DEBUG && console.log(`[${runId}]`, ...args);

  log('START');

  // 1) Grilles non terminées
  const { data: grids, error: gErr } = await supabase
    .from('grids')
    .select('id, competition_id')
    .eq('grid_done', false);

  if (gErr) throw new Error(gErr.message);
  log('grids candidates', grids?.length || 0);
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
  log('grid_items rows', items?.length || 0);
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
  log('unique match ids', allMatchIds.length);
  if (!allMatchIds.length) return 0;

  // 3) Charger les statuts des matchs concernés
  const { data: mRows, error: mErr } = await supabase
    .from('matches')
    .select('id, status')
    .in('id', allMatchIds);

  if (mErr) throw new Error(mErr.message);
  log('matches fetched', { expected: allMatchIds.length, got: mRows?.length || 0 });

  const statusByMatch = new Map<string, string>(
    (mRows || []).map((m) => [String(m.id), String(m.status)])
  );

  // Statuts "fin de match"
  const FINISHED_STATUSES = new Set(['ET', 'BT', 'P', 'FT', 'AET', 'PEN']);
  const isFinished = (s: any) => FINISHED_STATUSES.has(String(s || '').trim().toUpperCase());

  // 4) Déterminer les grilles terminées
  const finishedGrids = new Set<string>();
  const probeGridId = gridIds[0];

  for (const gid of gridIds) {
    const mids = matchIdsByGrid.get(gid) || [];
    if (!mids.length) continue;

    if (DEBUG && gid === probeGridId) {
      const sample = mids.slice(0, 9).map((mid) => ({
        mid,
        status: statusByMatch.get(mid),
      }));
      log('probe grid', { gid, matches: mids.length, sample });
    }

    const allFinished = mids.every((mid) => isFinished(statusByMatch.get(mid) || ''));
    if (allFinished) finishedGrids.add(gid);
  }

  log('finishedGrids', { count: finishedGrids.size, sample: Array.from(finishedGrids).slice(0, 5) });
  if (!finishedGrids.size) return 0;

  // 5) Marquer grid_done = true
  const { error: updErr } = await supabase
    .from('grids')
    .update({ grid_done: true })
    .in('id', Array.from(finishedGrids));

  if (updErr) throw new Error(updErr.message);
  log('grid_done update OK');

  // 6) Players ayant "joué" la grille = (≥1 pick) OU (≥1 bonus)

  // 6a) picks (au moins 1 pick non null)
  const { data: pickPlayers, error: pickErr } = await supabase
    .from('grid_matches')
    .select('grid_id, user_id')
    .in('grid_id', Array.from(finishedGrids))
    .not('pick', 'is', null);

  if (pickErr) throw new Error(pickErr.message);
  log('pickPlayers rows', pickPlayers?.length || 0);

  // 6b) bonus (au moins 1 ligne dans grid_bonus)
  const { data: bonusPlayers, error: bonusErr } = await supabase
    .from('grid_bonus')
    .select('grid_id, user_id')
    .in('grid_id', Array.from(finishedGrids));

  if (bonusErr) throw new Error(bonusErr.message);
  log('bonusPlayers rows', bonusPlayers?.length || 0);

  // merge dans usersByGrid
  const usersByGrid = new Map<string, Set<string>>();
  const addUG = (gridId: any, userId: any) => {
    const gid = String(gridId);
    const uid = String(userId);
    if (!usersByGrid.has(gid)) usersByGrid.set(gid, new Set());
    usersByGrid.get(gid)!.add(uid);
  };

  for (const r of pickPlayers || []) addUG(r.grid_id, r.user_id);
  for (const r of bonusPlayers || []) addUG(r.grid_id, r.user_id);

  // Debug : combien d'utilisateurs uniques par grille (joueurs ayant joué)
  if (DEBUG) {
    for (const gid of Array.from(finishedGrids)) {
      log('played users in grid', { gid, count: (usersByGrid.get(gid)?.size || 0) });
    }
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

  if (DEBUG) {
    const byPlatform: Record<string, number> = {};
    for (const t of tokensRows || []) {
      const p = String((t as any).platform || 'NULL');
      byPlatform[p] = (byPlatform[p] || 0) + 1;
    }
    log('tokens by platform', byPlatform);
  }

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

  // 9) Envoi + push_log (push_log seulement si token OK)
  let sentCount = 0;
  const toDelete = new Set<string>();

  const ONC = 'user_id,kind,grid_id';

  for (const gridId of Array.from(finishedGrids)) {
    const compId = gridToComp.get(gridId);
    if (!compId) continue;

    const allUsers = Array.from(usersByGrid.get(gridId) || []);
    log('grid loop', { gridId, compId, playedUsers: allUsers.length });

    const eligibleUsers = allUsers.filter((uid) => {
      const eliminated = eliminatedByComp.has(`${uid}|${compId}`);
      return !offSet.has(uid) && !eliminated;
    });

    log('eligible users', { gridId, count: eligibleUsers.length });

    for (const uid of eligibleUsers) {
      // ✅ 1) tokens d'abord
      const userTokens = pickPreferredTokensForUser(uid);
      if (!userTokens.length) {
        if (DEBUG) {
          const rawRows = (tokensRows || []).filter((t) => String(t.user_id) === uid);
          log('SKIP no token', {
            uid,
            rawTokenCount: rawRows.length,
            platforms: rawRows.map((r) => String((r as any).platform)),
            priority: PLATFORM_PRIORITY,
          });
        }
        continue;
      }

      // ✅ 2) dédup (push_log) ensuite
      const { error: logErr } = await supabase
        .from('push_log')
        .upsert(
          { user_id: uid, kind: 'GRID_DONE', grid_id: gridId, match_id: null },
          { onConflict: ONC }
        );

      if (logErr) {
        log('push_log ERROR', { uid, gridId, msg: logErr.message });
        continue;
      }

      // ✅ 3) send
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
            log('send ERROR', { uid, msg });

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
    log('deleted bad tokens', toDelete.size);
  }

  log('DONE sentCount', sentCount);
  return sentCount;
}


