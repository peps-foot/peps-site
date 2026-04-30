// src/app/api/push/cron/route.ts
// Rappels H-1 / J-1 et notification "grille terminée"
export const runtime = 'nodejs';
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { messaging } from '../../../../lib/firebaseAdmin';

const webpush = require('web-push') as typeof import('web-push');

const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const VAPID_PUBLIC_KEY  = 'BIIjmxt6CvJjd8EiHDtyBWgIvoDKO7eUjNJ_7FuN7vonLqolOVeWeilCoE2jIpeyN6Y02PZJ87B5MPRuywucWZE';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'aDNoUdMC-E95kgkI4qI-HL76jvvybdFU7vBDxTgoW-0';

webpush.setVapidDetails('mailto:hello@peps-foot.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// ─── Constantes ───────────────────────────────────────────────────────────────
const WINDOW_MINUTES          = 10;
const BIELSA_ID               = 'cee1eccc-28bf-4cbf-9968-2e7479d3b19f';
const PLATFORM_PRIORITY       = ['twa', 'android', 'web', 'ios'] as const;
const FINISHED_STATUSES       = new Set(['ET', 'BT', 'P', 'FT', 'AET', 'PEN']);

type Kind     = 'H24' | 'H1' | 'GRID_DONE';
type Platform = 'twa' | 'android' | 'web' | 'ios';

// ─── Entrée HTTP ──────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get('type') || '').toUpperCase() as Kind;
  const only = searchParams.get('only') || null; // filtre debug : user_id unique

  if (!['H24', 'H1', 'GRID_DONE'].includes(type)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'type must be H24|H1|GRID_DONE' }),
      { status: 400 }
    );
  }

  try {
    const count = type === 'GRID_DONE'
      ? await handleGridDone(only)
      : await handleMatchReminder(type, only);
    return Response.json({ ok: true, type, sent: count });
  } catch (e: any) {
    console.error('[CRON] fatal error', e);
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || 'unknown' }),
      { status: 500 }
    );
  }
}

// ─── Envoi d'une notif (iOS ou FCM) ──────────────────────────────────────────
function isIosToken(token: string): boolean {
  try {
    const p = JSON.parse(token);
    return typeof p.endpoint === 'string' && p.endpoint.includes('apple.com');
  } catch { return false; }
}

async function sendPush(token: string, title: string, body: string, url: string, tag: string): Promise<'ok' | 'invalid' | 'error'> {
  const icon = '/images/notifications/peps-notif-icon-192.png';

  if (isIosToken(token)) {
    try {
      const sub = JSON.parse(token) as { endpoint: string; keys: { p256dh: string; auth: string } };
      await webpush.sendNotification(sub, JSON.stringify({
          // Format reconnu par Apple Push Notification Service
          // "notification" → affiché nativement par iOS si le SW est lent
          // "data" → utilisé par le SW pour enrichir (url, tag)
          notification: { title, body, icon },
          data: { url, tag },
        }), { urgency: 'high', TTL: 10 });
      return 'ok';
    } catch (e: any) {
      const s = e?.statusCode;
      return (s === 404 || s === 410) ? 'invalid' : 'error';
    }
  }

  try {
    await messaging.send({
      token,
      webpush: {
        headers: { Urgency: 'high', TTL: '10' },
        // Le bloc notification dit à FCM quoi afficher directement —
        // plus fiable que de laisser le SW reconstruire la notif.
        // Pas de bloc notification — le SW affiche via onBackgroundMessage
        data: { title, body, icon, url, tag },
      },
    });
    return 'ok';
  } catch (e: any) {
    const msg = String(e?.errorInfo?.code || e?.message || '');
    return (msg.includes('registration-token-not-registered') || msg.includes('invalid-argument'))
      ? 'invalid' : 'error';
  }
}

// ─── Choix du token préféré pour un user ─────────────────────────────────────
function pickToken(
  tokensRows: { token: string; user_id: string; platform: string }[],
  uid: string
): string | null {
  const rows = tokensRows.filter(r => r.user_id === uid);
  for (const p of PLATFORM_PRIORITY) {
    const found = rows.find(r => r.platform === p);
    if (found) return found.token;
  }
  return null;
}

// ─── Charger les membres d'une ou plusieurs compétitions ─────────────────────
// Retourne un Set de "user_id|competition_id"
async function loadMembersSet(compIds: string[]): Promise<Set<string>> {
  if (!compIds.length) return new Set();
  const { data, error } = await supabase
    .from('competition_members')
    .select('user_id, competition_id')
    .in('competition_id', compIds)
    .in('role', ['PLAYER', 'CREATOR']);
  if (error) throw new Error('competition_members: ' + error.message);
  const set = new Set<string>();
  for (const r of data || []) set.add(`${r.user_id}|${r.competition_id}`);
  return set;
}

// ─── Charger les éliminés (can_play = false) ─────────────────────────────────
// Retourne un Set de "user_id|competition_id"
async function loadEliminatedSet(compIds: string[]): Promise<Set<string>> {
  if (!compIds.length) return new Set();
  const { data, error } = await supabase
    .from('grid_player_eligibility')
    .select('user_id, competition_id, can_play')
    .in('competition_id', compIds)
    .eq('can_play', false);
  if (error) throw new Error('grid_player_eligibility: ' + error.message);
  const set = new Set<string>();
  for (const r of data || []) set.add(`${r.user_id}|${r.competition_id}`);
  return set;
}

// ─── Vérifier si une notif a déjà été envoyée (push_log) ─────────────────────
// Pour H1/H24 : unicité sur (user_id, kind, match_id) — un joueur peut recevoir
// plusieurs rappels pour la même grille s'il a plusieurs matchs sans pick.
// Pour GRID_DONE : unicité sur (user_id, kind, grid_id).
async function alreadyLogged(uid: string, kind: Kind, matchId: string | null, gridId: string | null): Promise<boolean> {
  let q = supabase
    .from('push_log')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', uid)
    .eq('kind', kind);

  if (kind === 'GRID_DONE' && gridId) {
    q = q.eq('grid_id', gridId);
  } else if (matchId) {
    q = q.eq('match_id', matchId);
  }

  const { count } = await q;
  return (count ?? 0) > 0;
}

// ─── Inscrire dans push_log ───────────────────────────────────────────────────
async function writeLog(uid: string, kind: Kind, matchId: string | null, gridId: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('push_log')
    .insert({ user_id: uid, kind, match_id: matchId, grid_id: gridId });

  if (error) {
    // code 23505 = contrainte UNIQUE violée → déjà envoyé
    if ((error as any).code === '23505') return false;
    throw new Error('push_log insert: ' + error.message);
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAS 1 : Rappels H-24 / H-1
// ─────────────────────────────────────────────────────────────────────────────
async function handleMatchReminder(kind: 'H24' | 'H1', only: string | null): Promise<number> {
  const log = (...a: any[]) => console.log('[CRON][' + kind + ']', ...a);
  log('START');

  const now = new Date();
  const deltaMs = (kind === 'H24' ? 24 * 60 : 60) * 60 * 1000;
  const target  = new Date(now.getTime() + deltaMs);
  const halfW   = (WINDOW_MINUTES / 2) * 60 * 1000;
  const start   = new Date(target.getTime() - halfW);
  const end     = new Date(target.getTime() + halfW);

  // 1) Matchs dans la fenêtre temporelle, encore NS
  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select('id, date, status')
    .gte('date', start.toISOString())
    .lt('date', end.toISOString())
    .eq('status', 'NS');

  if (mErr) throw new Error('matches: ' + mErr.message);
  if (!matches?.length) { log('no matches in window'); return 0; }

  const matchIds = matches.map(m => String(m.id));
  log('matches in window', matchIds.length);

  // 2) grid_matches pour ces matchs (tous les joueurs avec une ligne)
  const { data: gms, error: gmErr } = await supabase
    .from('grid_matches')
    .select('user_id, match_id, grid_id, competition_id, pick')
    .in('match_id', matchIds);

  if (gmErr) throw new Error('grid_matches: ' + gmErr.message);
  if (!gms?.length) { log('no grid_matches'); return 0; }

  // 3) Récupérer les compétitions concernées
  const compIds = Array.from(new Set(gms.map(r => String(r.competition_id)).filter(Boolean)));

  // gridIds des matchs dans la fenêtre (pour savoir quels matchs notifier)
  const gridIdsInWindow = Array.from(new Set(gms.map(r => String(r.grid_id)).filter(Boolean)));

  // ⚠️ Pour les bonus, on charge TOUTES les grilles de ces compétitions —
  // pas seulement celles des matchs dans la fenêtre. Sinon un bonus BIELSA posé
  // sur un match hors fenêtre (mais dans la même grille) serait manqué.
  const { data: allGridsInComps, error: agErr } = await supabase
    .from('grids')
    .select('id')
    .in('competition_id', compIds);
  if (agErr) throw new Error('grids for comps: ' + agErr.message);
  const allGridIds = (allGridsInComps || []).map(g => String(g.id));

  // 4) Charger les membres, éliminés, préférences, bonus, tokens en parallèle
  const [membersSet, eliminatedSet, prefsRaw, bonusRows, tokensRows] = await Promise.all([
    loadMembersSet(compIds),
    loadEliminatedSet(compIds),

    supabase
      .from('push_prefs')
      .select('user_id, allow_match_reminder_24h, allow_match_reminder_1h')
      .then(r => { if (r.error) throw new Error('push_prefs: ' + r.error.message); return r.data || []; }),

    // Bonus sur TOUTES les grilles des compétitions concernées
    // (nécessaire pour détecter BIELSA posé sur un match hors fenêtre)
    supabase
      .from('grid_bonus')
      .select('user_id, grid_id, match_id, bonus_definition, parameters')
      .in('grid_id', allGridIds)
      .then(r => { if (r.error) throw new Error('grid_bonus: ' + r.error.message); return r.data || []; }),

    supabase
      .from('push_tokens')
      .select('token, user_id, platform')
      .then(r => { if (r.error) throw new Error('push_tokens: ' + r.error.message); return r.data || []; }),
  ]);

  // Joueurs qui ont désactivé les rappels
  const prefOffSet = new Set(
    prefsRaw
      .filter(r => kind === 'H24' ? r.allow_match_reminder_24h === false : r.allow_match_reminder_1h === false)
      .map(r => String(r.user_id))
  );

  // Set "uid|match_id" = a posé un bonus sur CE match (n'importe quel bonus sauf BIELSA géré séparément)
  const bonusOnMatch = new Set<string>();
  // Set "uid|grid_id" = a posé un bonus BIELSA sur cette grille
  const bielsaOnGrid = new Set<string>();

  for (const b of bonusRows) {
    const uid    = String(b.user_id);
    const gridId = String(b.grid_id);

    if (b.bonus_definition === BIELSA_ID) {
      bielsaOnGrid.add(`${uid}|${gridId}`);
    }

    // Bonus sur un match précis (match_id direct)
    if (b.match_id) {
      bonusOnMatch.add(`${uid}|${String(b.match_id)}`);
    }

    // Bonus avec matchs dans parameters (match_zero, match_win…)
    if (b.parameters && typeof b.parameters === 'object') {
      const p = b.parameters as any;
      for (const key of ['match_zero', 'match_win']) {
        if (p[key] != null) bonusOnMatch.add(`${uid}|${String(p[key])}`);
      }
    }
  }

  // 5) Construire la liste des (uid, match_id, grid_id, comp_id) à notifier
  // Regrouper par "uid|match_id|grid_id|comp_id" pour éviter les doublons
  type Todo = { uid: string; matchId: string; gridId: string; compId: string };
  const todos: Todo[] = [];

  for (const r of gms) {
    const uid    = String(r.user_id);
    const matchId = String(r.match_id);
    const gridId  = String(r.grid_id);
    const compId  = String(r.competition_id);

    // Condition 1 : pas de pick sur ce match
    if (r.pick != null) continue;

    // Condition 2 : pas de bonus sur ce match
    if (bonusOnMatch.has(`${uid}|${matchId}`)) continue;

    // Condition 3 : pas de bonus BIELSA sur la grille
    if (bielsaOnGrid.has(`${uid}|${gridId}`)) continue;

    // Condition 4 : membre de la compétition
    if (!membersSet.has(`${uid}|${compId}`)) continue;

    // Condition 5 : pas éliminé
    if (eliminatedSet.has(`${uid}|${compId}`)) continue;

    // Condition 6 : préférence ON (ou pas de ligne → ON par défaut)
    if (prefOffSet.has(uid)) continue;

    // Filtre debug
    if (only && uid !== only) continue;

    todos.push({ uid, matchId, gridId, compId });
  }

  log('todos before dedup', todos.length);

  // 6) Grouper par (uid, grid_id) → une seule notif par joueur par grille
  // mais on enregistre une ligne push_log par match pour l'anti-doublon
  type Group = { uid: string; compId: string; matchIds: string[]; gridId: string };
  const groupMap = new Map<string, Group>();

  for (const { uid, matchId, gridId, compId } of todos) {
    const key = `${uid}|${gridId}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { uid, compId, gridId, matchIds: [] });
    }
    // Dédoublonner le match_id (même match dans 2 grilles différentes)
    const group = groupMap.get(key)!;
    if (!group.matchIds.includes(matchId)) {
      group.matchIds.push(matchId);
    }
  }

  log('groups after dedup', groupMap.size);

  // 7) Envoi — une notif par groupe, X lignes push_log
  let sentCount = 0;
  const toDelete = new Set<string>();

  for (const { uid, compId, gridId, matchIds } of groupMap.values()) {
    // Vérifier si TOUS les matchs du groupe sont déjà dans push_log
    // Si au moins un ne l'est pas, on doit envoyer
    const alreadyAll = await Promise.all(
      matchIds.map(mid => alreadyLogged(uid, kind, mid, null))
    );
    if (alreadyAll.every(a => a)) {
      log('skip already logged (all matches)', { uid, gridId });
      continue;
    }

    const token = pickToken(tokensRows as any, uid);
    if (!token) { log('skip no token', { uid }); continue; }

    // Inscrire UNE ligne par match dans push_log AVANT l'envoi
    let anyLogged = false;
    for (const mid of matchIds) {
      const logged = await writeLog(uid, kind, mid, null);
      if (logged) anyLogged = true;
      else log('match already in log (skipped)', { uid, mid });
    }
    if (!anyLogged) { log('skip all log conflicts', { uid, gridId }); continue; }

    // Message adapté au nombre de matchs sans prono
    const title = kind === 'H24' ? '⏰ Rappel J-1' : '⏰ Rappel H-1';
    const body = matchIds.length === 1
      ? 'Tu as un match sans prono qui démarre bientôt !'
      : `Tu as ${matchIds.length} matchs sans prono qui démarrent bientôt !`;

    const result = await sendPush(token, title, body, 'https://www.peps-foot.com/', 'peps-reminder');

    if (result === 'ok') {
      sentCount++;
      log('sent', { uid, matchIds, compId });
    } else if (result === 'invalid') {
      toDelete.add(token);
      log('invalid token', { uid, token: token.slice(0, 30) });
    }
  }

  if (toDelete.size) {
    await supabase.from('push_tokens').delete().in('token', Array.from(toDelete));
    log('deleted invalid tokens', toDelete.size);
  }

  log('DONE sent', sentCount);
  return sentCount;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAS 2 : Grille terminée
// ─────────────────────────────────────────────────────────────────────────────
async function handleGridDone(only: string | null): Promise<number> {
  const log = (...a: any[]) => console.log('[CRON][GRID_DONE]', ...a);
  log('START');

  // 1) Grilles non encore marquées terminées
  const { data: grids, error: gErr } = await supabase
    .from('grids')
    .select('id, competition_id')
    .eq('grid_done', false);

  if (gErr) throw new Error('grids: ' + gErr.message);
  if (!grids?.length) { log('no pending grids'); return 0; }

  const gridIds  = grids.map(g => String(g.id));
  const compIds  = Array.from(new Set(grids.map(g => String(g.competition_id)).filter(Boolean)));
  const gridToComp = new Map(grids.map(g => [String(g.id), String(g.competition_id)]));

  log('pending grids', gridIds.length);

  // 2) Composition des grilles (via grid_items)
  const { data: items, error: itErr } = await supabase
    .from('grid_items')
    .select('grid_id, match_id')
    .in('grid_id', gridIds);

  if (itErr) throw new Error('grid_items: ' + itErr.message);
  if (!items?.length) { log('no grid_items'); return 0; }

  const matchIdsByGrid = new Map<string, string[]>();
  const allMatchIds    = new Set<string>();

  for (const it of items) {
    const gid = String(it.grid_id);
    const mid = String(it.match_id);
    if (!matchIdsByGrid.has(gid)) matchIdsByGrid.set(gid, []);
    matchIdsByGrid.get(gid)!.push(mid);
    allMatchIds.add(mid);
  }

  // 3) Statuts des matchs concernés
  const { data: mRows, error: mErr } = await supabase
    .from('matches')
    .select('id, status')
    .in('id', Array.from(allMatchIds));

  if (mErr) throw new Error('matches: ' + mErr.message);

  const statusByMatch = new Map((mRows || []).map(m => [String(m.id), String(m.status)]));

  // 4) Grilles dont tous les matchs sont terminés
  const finishedGrids = new Set<string>();
  for (const gid of gridIds) {
    const mids = matchIdsByGrid.get(gid) || [];
    if (mids.length && mids.every(mid => FINISHED_STATUSES.has(statusByMatch.get(mid) || ''))) {
      finishedGrids.add(gid);
    }
  }

  log('finished grids', finishedGrids.size);
  if (!finishedGrids.size) return 0;

  // 5) Marquer grid_done = true
  const { error: updErr } = await supabase
    .from('grids')
    .update({ grid_done: true })
    .in('id', Array.from(finishedGrids));

  if (updErr) throw new Error('grid_done update: ' + updErr.message);
  log('grid_done updated OK');

  // 6) Joueurs ayant participé à ces grilles (≥1 pick OU ≥1 bonus)
  const finishedArr = Array.from(finishedGrids);

  const [pickRows, bonusRows] = await Promise.all([
    supabase.from('grid_matches').select('grid_id, user_id').in('grid_id', finishedArr).not('pick', 'is', null)
      .then(r => { if (r.error) throw new Error('grid_matches picks: ' + r.error.message); return r.data || []; }),
    supabase.from('grid_bonus').select('grid_id, user_id').in('grid_id', finishedArr)
      .then(r => { if (r.error) throw new Error('grid_bonus: ' + r.error.message); return r.data || []; }),
  ]);

  // usersByGrid : grid_id → Set<user_id>
  const usersByGrid = new Map<string, Set<string>>();
  const addUG = (gridId: any, userId: any) => {
    const gid = String(gridId); const uid = String(userId);
    if (!usersByGrid.has(gid)) usersByGrid.set(gid, new Set());
    usersByGrid.get(gid)!.add(uid);
  };
  for (const r of pickRows)  addUG(r.grid_id, r.user_id);
  for (const r of bonusRows) addUG(r.grid_id, r.user_id);

  // 7) Membres, éliminés, préférences, tokens
  const [membersSet, eliminatedSet, prefsRaw, tokensRows] = await Promise.all([
    loadMembersSet(compIds),
    loadEliminatedSet(compIds),
    supabase.from('push_prefs').select('user_id, allow_grid_done')
      .then(r => { if (r.error) throw new Error('push_prefs: ' + r.error.message); return r.data || []; }),
    supabase.from('push_tokens').select('token, user_id, platform')
      .then(r => { if (r.error) throw new Error('push_tokens: ' + r.error.message); return r.data || []; }),
  ]);

  const prefOffSet = new Set(
    prefsRaw.filter(r => r.allow_grid_done === false).map(r => String(r.user_id))
  );

  // 8) Envoi
  let sentCount = 0;
  const toDelete = new Set<string>();

  for (const gridId of finishedArr) {
    const compId  = gridToComp.get(gridId);
    if (!compId) continue;

    const users = Array.from(usersByGrid.get(gridId) || []);
    log('grid', gridId, 'users', users.length);

    for (const uid of users) {
      if (only && uid !== only) continue;

      // Membre de la compétition
      if (!membersSet.has(`${uid}|${compId}`)) continue;

      // Pas éliminé
      if (eliminatedSet.has(`${uid}|${compId}`)) continue;

      // Préférence ON
      if (prefOffSet.has(uid)) continue;

      // Anti-doublon : vérification explicite avant insert
      const already = await alreadyLogged(uid, 'GRID_DONE', null, gridId);
      if (already) { log('skip already logged', { uid, gridId }); continue; }

      const token = pickToken(tokensRows as any, uid);
      if (!token) { log('skip no token', { uid }); continue; }

      // Inscrire dans push_log AVANT l'envoi
      const logged = await writeLog(uid, 'GRID_DONE', null, gridId);
      if (!logged) { log('skip log conflict', { uid, gridId }); continue; }

      const result = await sendPush(
        token,
        '🎉 Grille terminée',
        'Les résultats sont là. Viens voir ton score !',
        'https://www.peps-foot.com/',
        'peps-grid-done'
      );

      if (result === 'ok') {
        sentCount++;
        log('sent', { uid, gridId, compId });
      } else if (result === 'invalid') {
        toDelete.add(token);
        log('invalid token', { uid });
      }
    }
  }

  if (toDelete.size) {
    await supabase.from('push_tokens').delete().in('token', Array.from(toDelete));
    log('deleted invalid tokens', toDelete.size);
  }

  log('DONE sent', sentCount);
  return sentCount;
}