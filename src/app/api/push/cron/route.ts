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
      // ⚠️ iOS UNIQUEMENT : ne pas mettre de bloc "notification" dans le payload.
      // Si un bloc "notification" est présent, Apple affiche la notif nativement
      // ET le SW en affiche une via le listener "push" → doublon.
      // On n'envoie que "data" : le SW natif (listener "push") prend tout en charge.
      await webpush.sendNotification(sub, JSON.stringify({
          data: { title, body, icon, url, tag },
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

// ─── Tous les tokens d'un user (multi-appareil) ──────────────────────────────
// On envoie à TOUS les tokens de l'utilisateur, triés par priorité de plateforme.
// Un user avec twa + web recevra la notif sur les deux appareils simultanément.
function pickTokens(
  tokensRows: { token: string; user_id: string; platform: string }[],
  uid: string
): string[] {
  const rows = tokensRows.filter(r => r.user_id === uid);
  // Trier par priorité de plateforme
  rows.sort((a, b) => {
    const ai = PLATFORM_PRIORITY.indexOf(a.platform as Platform);
    const bi = PLATFORM_PRIORITY.indexOf(b.platform as Platform);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return rows.map(r => r.token);
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
    .select('id, date, status, team_home_id, team_away_id')
    .gte('date', start.toISOString())
    .lt('date', end.toISOString())
    .eq('status', 'NS');

  if (mErr) throw new Error('matches: ' + mErr.message);
  if (!matches?.length) { log('no matches in window'); return 0; }

  const matchIds = matches.map(m => String(m.id));
  log('matches in window', matchIds.length);

  // ===========================================================================
  // 2) GRID : logique basée sur les grilles actives + membres de compétition
  // ===========================================================================
  // On ne part PAS de grid_matches pour déterminer qui doit être notifié :
  // un joueur peut avoir une ligne grid_matches même s'il est éliminé.
  const { data: gridComps, error: gcErr } = await supabase
    .from('competitions')
    .select('id, game_type')
    .eq('game_type', 'GRID');
  if (gcErr) throw new Error('grid competitions: ' + gcErr.message);

  const gridCompetitionIds: string[] = (gridComps || []).map(c => String(c.id));

  const { data: gridCompetitionLinks, error: cgeErr } = gridCompetitionIds.length
    ? await supabase
        .from('competition_grids')
        .select('competition_id, grid_id')
        .in('competition_id', gridCompetitionIds)
    : { data: [], error: null };
  if (cgeErr) throw new Error('competition_grids: ' + cgeErr.message);

  const gridToComp = new Map<string, string>();
  for (const row of gridCompetitionLinks || []) {
    gridToComp.set(String(row.grid_id), String(row.competition_id));
  }

  const gridIdsLinked = Array.from(gridToComp.keys());

  const { data: activeGridRows, error: agrErr } = gridIdsLinked.length
    ? await supabase
        .from('grids')
        .select('id, competition_id')
        .in('id', gridIdsLinked)
        .eq('grid_done', false)
    : { data: [], error: null };
  if (agrErr) throw new Error('active grids: ' + agrErr.message);

  const activeGridIds = (activeGridRows || []).map(g => String(g.id));
  const activeGridSet = new Set(activeGridIds);

  // La compétition associée à une grille vient de competition_grids.
  // On ne garde que les grilles réellement reliées à une compétition GRID.
  const activeGridCompIds = Array.from(new Set(
    activeGridIds
      .map(gid => gridToComp.get(gid))
      .filter((id): id is string => Boolean(id))
  ));
  const gridCompIds: string[] = activeGridCompIds;

  // Membres GRID : uniquement PLAYER / CREATOR.
  const gridMembersSet = new Set<string>();
  if (gridCompIds.length) {
    const { data: gridMembers, error: gmemErr } = await supabase
      .from('competition_members')
      .select('user_id, competition_id')
      .in('competition_id', gridCompIds)
      .in('role', ['PLAYER', 'CREATOR']);
    if (gmemErr) throw new Error('GRID competition_members: ' + gmemErr.message);
    for (const r of gridMembers || []) {
      gridMembersSet.add(`${String(r.user_id)}|${String(r.competition_id)}`);
    }
  }

  // Les matchs de chaque grille active.
  const { data: gridItems, error: giErr } = activeGridIds.length
    ? await supabase
        .from('grid_items')
        .select('grid_id, match_id')
        .in('grid_id', activeGridIds)
        .in('match_id', matchIds)
    : { data: [], error: null };
  if (giErr) throw new Error('grid_items: ' + giErr.message);

  const gridMatchIds = Array.from(new Set(
    (gridItems || []).map(r => String(r.match_id))
  ));

  // Toutes les grilles des compétitions concernées sont chargées pour les bonus :
  // un BIELSA placé sur une autre grille de la même compétition bloque le rappel.
  const { data: allGridsInComps, error: agErr } = gridCompIds.length
    ? await supabase
        .from('grids')
        .select('id')
        .in('competition_id', gridCompIds)
    : { data: [], error: null };
  if (agErr) throw new Error('grids for comps: ' + agErr.message);

  const allGridIds = (allGridsInComps || []).map(g => String(g.id));

  // Picks GRID sur les grilles actives et les matchs de la fenêtre.
  const { data: gms, error: gmErr } = activeGridIds.length && gridMatchIds.length
    ? await supabase
        .from('grid_matches')
        .select('user_id, match_id, grid_id, competition_id, pick')
        .in('grid_id', activeGridIds)
        .in('match_id', gridMatchIds)
    : { data: [], error: null };
  if (gmErr) throw new Error('grid_matches: ' + gmErr.message);

  const gridPickSet = new Set<string>();
  for (const r of gms || []) {
    if (r.pick != null) {
      gridPickSet.add(`${String(r.user_id)}|${String(r.grid_id)}|${String(r.match_id)}`);
    }
  }

  // Bonus GRID : bonus sur le match OU BIELSA sur la grille.
  const gridBonusRows = allGridIds.length
    ? await supabase
        .from('grid_bonus')
        .select('user_id, grid_id, match_id, bonus_definition, parameters')
        .in('grid_id', allGridIds)
        .then(r => {
          if (r.error) throw new Error('grid_bonus: ' + r.error.message);
          return r.data || [];
        })
    : [];

  const bonusOnMatch = new Set<string>();
  const bielsaOnGrid = new Set<string>();

  for (const b of gridBonusRows) {
    const uid = String(b.user_id);
    const gid = String(b.grid_id);

    if (b.bonus_definition === BIELSA_ID) {
      bielsaOnGrid.add(`${uid}|${gid}`);
    }

    if (b.match_id) {
      bonusOnMatch.add(`${uid}|${String(b.match_id)}`);
    }

    if (b.parameters && typeof b.parameters === 'object') {
      const params = b.parameters as any;
      for (const key of ['match_zero', 'match_win']) {
        if (params[key] != null) {
          bonusOnMatch.add(`${uid}|${String(params[key])}`);
        }
      }
    }
  }

  type GridTodo = { uid: string; matchId: string; gridId: string; compId: string };
  let gridTodos: GridTodo[] = [];

  // On teste chaque match de chaque grille active contre les joueurs
  // réellement membres de cette compétition.
  for (const item of gridItems || []) {
    const gridId = String(item.grid_id);
    const matchId = String(item.match_id);
    const compId = gridToComp.get(gridId);
    if (!compId || !activeGridSet.has(gridId)) continue;

    for (const memberKey of gridMembersSet) {
      const [uid, memberCompId] = memberKey.split('|');
      if (memberCompId !== compId) continue;

      // Un prono sur CE match / CETTE grille suffit.
      if (gridPickSet.has(`${uid}|${gridId}|${matchId}`)) continue;

      // Un bonus posé sur CE match suffit également.
      if (bonusOnMatch.has(`${uid}|${matchId}`)) continue;

      // BIELSA sur la grille = grille considérée comme remplie.
      if (bielsaOnGrid.has(`${uid}|${gridId}`)) continue;

      gridTodos.push({ uid, matchId, gridId, compId });
    }
  }

  // ===========================================================================
  // 3) SUPPORTER : déterminer les compétitions SUPPORTER concernées
  // ===========================================================================
  const { data: supporterComps, error: scErr } = await supabase
    .from('competitions')
    .select('id, game_type, supporter_team_id')
    .eq('game_type', 'SUPPORTER')
    .not('supporter_team_id', 'is', null);
  if (scErr) throw new Error('supporter competitions: ' + scErr.message);

  const supporterMatchComps = new Map<string, string[]>();
  for (const comp of supporterComps || []) {
    const teamId = Number(comp.supporter_team_id);
    if (!Number.isFinite(teamId)) continue;

    for (const m of matches) {
      if (Number(m.team_home_id) === teamId || Number(m.team_away_id) === teamId) {
        const mid = String(m.id);
        if (!supporterMatchComps.has(mid)) supporterMatchComps.set(mid, []);
        const list = supporterMatchComps.get(mid)!;
        const compId = String(comp.id);
        if (!list.includes(compId)) list.push(compId);
      }
    }
  }

  const supporterCompIds = Array.from(new Set(
    Array.from(supporterMatchComps.values()).flat()
  ));

  // ===========================================================================
  // 4) TIERCE : match -> ticket -> compétition
  // ===========================================================================
  const { data: tierceTicketMatches, error: ttmErr } = await supabase
    .from('tierce_ticket_matches')
    .select('ticket_id, match_id')
    .in('match_id', matchIds);
  if (ttmErr) throw new Error('tierce_ticket_matches: ' + ttmErr.message);

  const ticketIds = Array.from(new Set(
    (tierceTicketMatches || []).map(r => String(r.ticket_id))
  ));

  const { data: competitionTickets, error: ctErr } = ticketIds.length
    ? await supabase
        .from('competition_tickets')
        .select('competition_id, ticket_id')
        .in('ticket_id', ticketIds)
    : { data: [], error: null };
  if (ctErr) throw new Error('competition_tickets: ' + ctErr.message);

  const tierceMatchComps = new Map<string, string[]>();
  const tierceTicketToComps = new Map<string, string[]>();

  for (const row of competitionTickets || []) {
    const compId = String(row.competition_id);
    const ticketId = String(row.ticket_id);
    if (!tierceTicketToComps.has(ticketId)) tierceTicketToComps.set(ticketId, []);
    const list = tierceTicketToComps.get(ticketId)!;
    if (!list.includes(compId)) list.push(compId);
  }

  for (const row of tierceTicketMatches || []) {
    const mid = String(row.match_id);
    const comps = tierceTicketToComps.get(String(row.ticket_id)) || [];
    if (!tierceMatchComps.has(mid)) tierceMatchComps.set(mid, []);
    const list = tierceMatchComps.get(mid)!;
    for (const compId of comps) {
      if (!list.includes(compId)) list.push(compId);
    }
  }

  const tierceCompIds = Array.from(new Set(
    Array.from(tierceMatchComps.values()).flat()
  ));

  // Toutes les compétitions utilisées par les trois modes.
  const compIds: string[] = Array.from(new Set([
    ...gridCompIds,
    ...supporterCompIds,
    ...tierceCompIds,
  ]));

  if (!compIds.length) {
    log('no competitions linked to matches in window');
    return 0;
  }

  // ===========================================================================
  // 5) Charger membres, éliminés, préférences et tokens.
  // ===========================================================================
  const [membersSet, eliminatedSet, prefsRaw, tokensRows] = await Promise.all([
    loadMembersSet(compIds),
    loadEliminatedSet(compIds),

    supabase
      .from('push_prefs')
      .select('user_id, allow_match_reminder_24h, allow_match_reminder_1h')
      .then(r => { if (r.error) throw new Error('push_prefs: ' + r.error.message); return r.data || []; }),

    supabase
      .from('push_tokens')
      .select('token, user_id, platform')
      .then(r => { if (r.error) throw new Error('push_tokens: ' + r.error.message); return r.data || []; }),
  ]);

  const prefOffSet = new Set(
    prefsRaw
      .filter(r => kind === 'H24' ? r.allow_match_reminder_24h === false : r.allow_match_reminder_1h === false)
      .map(r => String(r.user_id))
  );

  // ===========================================================================
  // 6) GRID : filtres finaux applicables à tous les rappels
  // ===========================================================================
  gridTodos = gridTodos.filter(({ uid, compId }) => {
    if (eliminatedSet.has(`${uid}|${compId}`)) return false;
    if (prefOffSet.has(uid)) return false;
    if (only && uid !== only) return false;
    return true;
  });

  // ===========================================================================
  // 7) SUPPORTER
  // ===========================================================================
  const { data: supporterRows, error: spErr } = await supabase
    .from('supporter_predictions')
    .select('competition_id, user_id, match_id')
    .in(
      'competition_id',
      supporterCompIds.length ? supporterCompIds : ['00000000-0000-0000-0000-000000000000']
    )
    .in('match_id', matchIds);
  if (spErr) throw new Error('supporter_predictions: ' + spErr.message);

  const supporterPickSet = new Set<string>();
  for (const r of supporterRows || []) {
    supporterPickSet.add(`${String(r.user_id)}|${String(r.competition_id)}|${String(r.match_id)}`);
  }

  type OtherTodo = { uid: string; matchId: string; compId: string };
  const otherTodos: OtherTodo[] = [];
  const gridTodoMatchSet = new Set(
    gridTodos.map(t => `${t.uid}|${t.matchId}`)
  );

  const addOtherTodo = (uid: string, matchId: string, compId: string) => {
    if (only && uid !== only) return;
    if (!membersSet.has(`${uid}|${compId}`)) return;
    if (eliminatedSet.has(`${uid}|${compId}`)) return;
    if (prefOffSet.has(uid)) return;

    // Si le même joueur doit déjà recevoir une notif GRID pour ce match,
    // on ne crée pas une deuxième notif SUPPORTER/TIERCE.
    if (gridTodoMatchSet.has(`${uid}|${matchId}`)) return;

    const key = `${uid}|${matchId}`;
    if (otherTodos.some(t => `${t.uid}|${t.matchId}` === key)) return;
    otherTodos.push({ uid, matchId, compId });
  };

  for (const [matchId, compList] of supporterMatchComps) {
    for (const compId of compList) {
      for (const key of membersSet) {
        const [uid, memberCompId] = key.split('|');
        if (memberCompId !== compId) continue;
        if (supporterPickSet.has(`${uid}|${compId}|${matchId}`)) continue;
        addOtherTodo(uid, matchId, compId);
      }
    }
  }

  // ===========================================================================
  // 8) TIERCE
  // ===========================================================================
  const { data: tierceEntries, error: teErr } = await supabase
    .from('tierce_entries')
    .select('id, competition_id, ticket_id, user_id')
    .in(
      'competition_id',
      tierceCompIds.length ? tierceCompIds : ['00000000-0000-0000-0000-000000000000']
    );
  if (teErr) throw new Error('tierce_entries: ' + teErr.message);

  const entryIds = (tierceEntries || []).map(r => String(r.id));
  const { data: tierceLegRows, error: tlErr } = entryIds.length
    ? await supabase
        .from('tierce_entry_legs')
        .select('entry_id')
        .in('entry_id', entryIds)
    : { data: [], error: null };
  if (tlErr) throw new Error('tierce_entry_legs: ' + tlErr.message);

  const legsCountByEntry = new Map<string, number>();
  for (const r of tierceLegRows || []) {
    const eid = String(r.entry_id);
    legsCountByEntry.set(eid, (legsCountByEntry.get(eid) || 0) + 1);
  }

  const tierceFilledSet = new Set<string>();
  for (const entry of tierceEntries || []) {
    const count = legsCountByEntry.get(String(entry.id)) || 0;
    if (count >= 3) {
      tierceFilledSet.add(
        `${String(entry.user_id)}|${String(entry.competition_id)}|${String(entry.ticket_id)}`
      );
    }
  }

  for (const [matchId, compList] of tierceMatchComps) {
    const ticketIdsForMatch = (tierceTicketMatches || [])
      .filter(r => String(r.match_id) === matchId)
      .map(r => String(r.ticket_id));

    for (const compId of compList) {
      for (const key of membersSet) {
        const [uid, memberCompId] = key.split('|');
        if (memberCompId !== compId) continue;

        const filled = ticketIdsForMatch.some(ticketId =>
          tierceFilledSet.has(`${uid}|${compId}|${ticketId}`)
        );
        if (filled) continue;

        addOtherTodo(uid, matchId, compId);
      }
    }
  }

  log('GRID todos', gridTodos.length);
  log('SUPPORTER/TIERCE todos', otherTodos.length);

  // ===========================================================================
  // 9) Envoi
  //    GRID garde son ancien regroupement par joueur + grille.
  //    SUPPORTER/TIERCE sont regroupés par joueur + match.
  // ===========================================================================
  type Group = { uid: string; compId: string; matchIds: string[]; gridId: string | null };
  const groupMap = new Map<string, Group>();

  for (const { uid, matchId, gridId, compId } of gridTodos) {
    const key = `GRID|${uid}|${gridId}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { uid, compId, gridId, matchIds: [] });
    }
    const group = groupMap.get(key)!;
    if (!group.matchIds.includes(matchId)) group.matchIds.push(matchId);
  }

  for (const { uid, matchId, compId } of otherTodos) {
    const key = `OTHER|${uid}|${matchId}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { uid, compId, gridId: null, matchIds: [] });
    }
    const group = groupMap.get(key)!;
    if (!group.matchIds.includes(matchId)) group.matchIds.push(matchId);
  }

  log('groups after dedup', groupMap.size);

  let sentCount = 0;
  const toDelete = new Set<string>();

  for (const { uid, compId, gridId, matchIds } of groupMap.values()) {
    const alreadyAll = await Promise.all(
      matchIds.map(mid => alreadyLogged(uid, kind, mid, null))
    );
    if (alreadyAll.every(a => a)) {
      log('skip already logged (all matches)', { uid, gridId });
      continue;
    }

    let anyLogged = false;
    for (const mid of matchIds) {
      const logged = await writeLog(uid, kind, mid, null);
      if (logged) anyLogged = true;
      else log('match already in log (skipped)', { uid, mid });
    }
    if (!anyLogged) {
      log('skip all log conflicts', { uid, gridId });
      continue;
    }

    const tokens = pickTokens(tokensRows as any, uid);
    if (!tokens.length) {
      log('skip no token', { uid });
      continue;
    }

    const title = kind === 'H24' ? '⏰ Rappel J-1' : '⏰ Rappel H-1';
    const body = matchIds.length === 1
      ? 'Tu as un match sans prono qui démarre bientôt !'
      : `Tu as ${matchIds.length} matchs sans prono qui démarrent bientôt !`;

    for (const token of tokens) {
      const result = await sendPush(
        token,
        title,
        body,
        'https://www.peps-foot.com/',
        'peps-reminder'
      );

      if (result === 'ok') {
        sentCount++;
        log('sent', { uid, matchIds, compId, token: token.slice(0, 30) });
      } else if (result === 'invalid') {
        toDelete.add(token);
        log('invalid token', { uid, token: token.slice(0, 30) });
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

async function handleGridDone(only: string | null): Promise<number> {
  const log = (...a: any[]) => console.log('[CRON][GRID_DONE]', ...a);
  log('START');

  // 1) Grilles non encore marquées terminées
  const { data: grids, error: gErr } = await supabase
    .from('grids')
    .select('id, competition_id')
    .eq('grid_done', false)
    .not('competition_id', 'is', null);

  if (gErr) throw new Error('grids: ' + gErr.message);
  if (!grids?.length) { log('no pending grids'); return 0; }

  const gridIds  = grids.map(g => String(g.id));
  const compIds  = Array.from(new Set(grids
  .map(g => g.competition_id)
  .filter((id): id is string => Boolean(id))
  .map(String)));
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

      const tokens = pickTokens(tokensRows as any, uid);
      if (!tokens.length) { log('skip no token', { uid }); continue; }

      // Inscrire dans push_log AVANT l'envoi
      const logged = await writeLog(uid, 'GRID_DONE', null, gridId);
      if (!logged) { log('skip log conflict', { uid, gridId }); continue; }

      // Envoyer à tous les tokens de l'utilisateur (multi-appareil)
      for (const token of tokens) {
        const result = await sendPush(
          token,
          '🎉 Grille terminée',
          'Les résultats sont là. Viens voir ton score !',
          'https://www.peps-foot.com/',
          'peps-grid-done'
        );

        if (result === 'ok') {
          sentCount++;
          log('sent', { uid, gridId, compId, token: token.slice(0, 30) });
        } else if (result === 'invalid') {
          toDelete.add(token);
          log('invalid token', { uid });
        }
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