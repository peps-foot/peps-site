export const runtime = 'nodejs';
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { messaging } from '../../../../lib/firebaseAdmin';

const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const MATCH_STATUS_NOT_STARTED = 'NS';
const MATCH_STATUS_FINISHED    = 'FT';

// Petite fenêtre de tir pour éviter les doublons (si tu lances le cron toutes les 15 min)
const WINDOW_MINUTES = 15;

type Kind = 'H24' | 'H1' | 'GRID_DONE';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get('type') || '').toUpperCase() as Kind;
  const only = searchParams.get('only') || null;  
  if (!['H24','H1','GRID_DONE'].includes(type)) {
    return new Response(JSON.stringify({ ok:false, error:'type must be H24|H1|GRID_DONE' }), { status: 400 });
  }

  try {
    if (type === 'GRID_DONE') {
      const count = await handleGridDone();
      return Response.json({ ok:true, type, sent: count });
    } else if (type === 'H24' || type === 'H1') {
      const count = await handleMatchReminder(type, only); 
      return Response.json({ ok:true, type, sent: count });
    }
    return Response.json({ ok:true, type, sent: 0 });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error: e?.message || 'unknown' }), { status: 500 });
  }
}

// --- Rappels H-24 / H-1 ---
async function handleMatchReminder(kind: 'H24'|'H1', only: string | null) {
  const now = new Date();
  const delta = kind === 'H24' ? /* 24*60 */ 1 : 60; // 1 minute pour tester
  const start = new Date(now.getTime() + delta*60*1000);
  const end   = new Date(start.getTime() + WINDOW_MINUTES*60*1000);

  // 1) Matches qui commencent dans la fenêtre (NS)
    const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select('id, date, status')
    .gte('date', start.toISOString())
    .lt('date', end.toISOString())
    .eq('status', MATCH_STATUS_NOT_STARTED);

  if (mErr) throw new Error(mErr.message);
  if (!matches || !matches.length) return 0;

  const matchIds = matches.map(m => m.id);

  // 2) Joueurs sans pick pour ces matches (grid_matches.pick null)
  // ⚠️ Adapte 'pick' et clés si besoin: grid_matches(user_id, match_id, grid_id, competition_id, pick)
  const { data: gms, error: gmErr } = await supabase
    .from('grid_matches')
    .select('user_id, match_id, grid_id, competition_id, pick')
    .in('match_id', matchIds);

  if (gmErr) throw new Error(gmErr.message);
  if (!gms) return 0;

  // Users sans pick sur le match
  const todoByMatch = new Map<number, Set<string>>();
  for (const row of gms) {
    if (row.pick == null) {
      if (!todoByMatch.has(row.match_id)) todoByMatch.set(row.match_id, new Set());
      todoByMatch.get(row.match_id)!.add(row.user_id);
    }
  }
  if (!todoByMatch.size) return 0;

  // 3) Option "ont déjà joué la compet" : users qui ont AU MOINS un pick non-null sur la même compétition
  // (évite d’alerter les gens qui ne jouent pas la compé)
  // après avoir lu gms (grid_matches des matches ciblés) :
  const compIds = Array.from(new Set((gms || []).map(r => r.competition_id)));

  const { data: played, error: playedErr } = await supabase
    .from('grid_matches')
    .select('user_id, competition_id, pick')
    .in('competition_id', compIds)
    .not('pick', 'is', null);

  if (playedErr) throw new Error(playedErr.message);
  //const playedSet = new Set(played?.map(p => p.user_id) || []);

  // 4) Préférences ON: allow_match_reminder_24h / 1h (par défaut true si pas de ligne)
    type PrefRow = {
    user_id: string;
    allow_match_reminder_24h: boolean | null;
    allow_match_reminder_1h:  boolean | null;
    };

    const { data: prefsRaw, error: prefErr } = await supabase
    .from('push_prefs')
    .select('user_id, allow_match_reminder_24h, allow_match_reminder_1h');

    if (prefErr) throw new Error(prefErr.message);

    const prefs = (prefsRaw || []) as PrefRow[];

    // users qui ont explicitement désactivé le rappel demandé
    const offSet = new Set(
    prefs
        .filter(r => kind === 'H24' ? r.allow_match_reminder_24h === false
                                    : r.allow_match_reminder_1h  === false)
        .map(r => r.user_id)
    );


  // 5) Tokens liés aux users ciblés
let tokensQuery = supabase.from('push_tokens').select('token, user_id');
if (only) tokensQuery = tokensQuery.eq('user_id', only);

const { data: tokensRows, error: tErr } = await tokensQuery;
if (tErr) throw new Error(tErr.message);

  // 6) Construire la liste finale (en dédupliquant via push_log)
  let sentCount = 0;
  const toDelete = new Set<string>();

  console.log('[H1] matches=', matches.length, 'tokensRows=', (tokensRows||[]).length);
  for (const m of matches) {
    const users = todoByMatch.get(m.id);
    if (!users || !users.size) continue;

    // filtre: ont déjà joué la compet + n'ont pas désactivé la préférence
    //const eligibleUsers = Array.from(users).filter(uid => playedSet.has(uid) && !offSet.has(uid));
    const eligibleUsers = Array.from(users).filter(uid => !offSet.has(uid));
    console.log('[H1] match=', m.id, 'users=', users?.size || 0, 'eligible=', eligibleUsers.length);

    if (!eligibleUsers.length) continue;

    // dédup via push_log (unique (user_id, kind, match_id, grid_id))
    for (const uid of eligibleUsers) {
      // on loggue avant d'envoyer ; si déjà présent (23505), on saute cet user
        const ins = await supabase
        .from('push_log')
        .insert({ user_id: uid, kind, match_id: m.id, grid_id: null });

        if (ins.error) {
        const code = (ins.error as any).code || '';
        if (code === '23505') {
            // doublon → déjà envoyé récemment
            continue;
        }
        console.error('[H1] push_log insert error:', ins.error?.message);
        continue; // par prudence on n’envoie pas si autre erreur
        }

      // tokens du user
      const userTokens = (tokensRows || []).filter(t => t.user_id === uid).map(t => t.token);
      if (!userTokens.length) continue;

      // envoi
await Promise.all(userTokens.map(async (t) => {
  try {
        await messaging.send({
  token: t,
  webpush: {
    headers: { Urgency: 'high', TTL: '10' },
    data: {
      title: kind === 'H24' ? '⏰ Rappel J-1' : '⏰ Rappel H-1',
      body:  'Tu as des matchs non pariés qui démarrent bientôt.',
      url:   'https://www.peps-foot.com/',
      icon:  '/icon-512x512.png',
      tag:   'peps-reminder'
    },
    fcmOptions: { link: 'https://www.peps-foot.com/' }
  }
});

    sentCount++;
  } catch (e:any) {
    // ⬇️ ajoute juste cette ligne :
    console.error('[H1 send error]', e?.errorInfo?.code || e?.message, '(token=', String(t).slice(0,10), '...)');

    const msg = e?.errorInfo?.code || e?.message || '';
    if (String(msg).includes('registration-token-not-registered') || String(msg).includes('invalid-argument')) {
      toDelete.add(t);
    }
  }
}));

    }
  }

  if (toDelete.size) {
    await supabase.from('push_tokens').delete().in('token', Array.from(toDelete));
  }
  return sentCount;
}

// --- Grille terminée ---
async function handleGridDone() {
  // Idée simple : détecter les grilles dont TOUS les matches sont terminés depuis la dernière fenêtre,
  // puis notifier leurs participants (qui n’ont pas désactivé allow_grid_done)
  // ⚠️ Adapte les relations: grids(id, competition_id) + grid_matches(grid_id, match_id, user_id, pick)
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MINUTES*60*1000);

  // 1) grilles finies dans la fenêtre (il faut que tous ses matches soient FT)
  // Ici on fait en 2 temps pour rester simple côté supabase-js :
  const { data: grids, error: gErr } = await supabase
    .from('grids')
    .select('id, competition_id, updated_at')
    .gte('updated_at', windowStart.toISOString());  // supposition: ta grille se "met à jour" à la fin
  if (gErr) throw new Error(gErr.message);
  if (!grids || !grids.length) return 0;

  // Vérifie qu’il n’y a plus de match NS dans chaque grille
  const { data: gmAll, error: gmaErr } = await supabase
    .from('grid_matches')
    .select('grid_id, match_id');
  if (gmaErr) throw new Error(gmaErr.message);

  const { data: mAll, error: mErr } = await supabase
    .from('matches')
    .select('id, status');
  if (mErr) throw new Error(mErr.message);

  const statusByMatch = new Map(mAll?.map(m => [m.id, m.status]) || []);
  const finishedGrids = new Set<number>();
  for (const g of grids) {
    const rows = (gmAll || []).filter(r => r.grid_id === g.id);
    if (!rows.length) continue;
    const allFinished = rows.every(r => statusByMatch.get(r.match_id) === MATCH_STATUS_FINISHED);
    if (allFinished) finishedGrids.add(g.id);
  }
  if (!finishedGrids.size) return 0;

  // 2) participants des grilles finies
  const { data: participants, error: partErr } = await supabase
    .from('grid_matches')
    .select('grid_id, user_id')
    .in('grid_id', Array.from(finishedGrids));
  if (partErr) throw new Error(partErr.message);

  const usersByGrid = new Map<number, Set<string>>();
  for (const r of participants || []) {
    if (!usersByGrid.has(r.grid_id)) usersByGrid.set(r.grid_id, new Set());
    usersByGrid.get(r.grid_id)!.add(r.user_id);
  }

  // 3) filtre sur préférences allow_grid_done (par défaut: ON si pas de ligne)
  const { data: prefs, error: prefErr } = await supabase
    .from('push_prefs')
    .select('user_id, allow_grid_done');
  if (prefErr) throw new Error(prefErr.message);
  const offSet = new Set((prefs || []).filter(r => r.allow_grid_done === false).map(r => r.user_id));

  const { data: tokensRows, error: tErr } = await supabase
    .from('push_tokens')
    .select('token, user_id');
  if (tErr) throw new Error(tErr.message);

  let sentCount = 0;
  const toDelete = new Set<string>();

  for (const gridId of Array.from(finishedGrids)) {
    const users = Array.from(usersByGrid.get(gridId) || []).filter(uid => !offSet.has(uid));
    for (const uid of users) {
      // dédup
      const { error: logErr } = await supabase
        .from('push_log')
        .upsert({ user_id: uid, kind: 'GRID_DONE', match_id: null, grid_id: gridId }, { onConflict: 'user_id,kind,match_id,grid_id' });
      if (logErr) continue;

      const userTokens = (tokensRows || []).filter(t => t.user_id === uid).map(t => t.token);
      if (!userTokens.length) continue;

      await Promise.all(userTokens.map(async (t) => {
        try {
          await messaging.send({
            token: t,
            webpush: {
              headers: { Urgency: 'high', TTL: '10' },
              data: {
                title: '🎉 Grille terminée',
                body:  'Les résultats sont là. Viens voir ton score !',
                url:   'https://www.peps-foot.com/',
                icon:  '/icon-512x512.png',
                tag:   'peps-grid-done'
              },
              fcmOptions: { link: 'https://www.peps-foot.com/' }
            }
          });
          sentCount++;
        } catch (e:any) {
          const msg = e?.errorInfo?.code || e?.message || '';
          if (String(msg).includes('registration-token-not-registered') || String(msg).includes('invalid-argument')) {
            toDelete.add(t);
          }
        }
      }));
    }
  }

  if (toDelete.size) {
    await supabase.from('push_tokens').delete().in('token', Array.from(toDelete));
  }
  return sentCount;
}
