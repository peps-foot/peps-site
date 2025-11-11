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
const WINDOW_MINUTES = 15; // fenêtre anti-doublons
type Kind = 'H24' | 'H1' | 'GRID_DONE';

// ordre de priorité d’envoi par plateforme
const PLATFORM_PRIORITY = ['twa', 'android', 'web', 'ios'] as const;

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
  const deltaMinutes = kind === 'H24' ? 24 * 60 : 60; // remet 24*60 en prod pour J-1
  const start = new Date(now.getTime() + deltaMinutes * 60 * 1000);
  const end   = new Date(start.getTime() + WINDOW_MINUTES * 60 * 1000);

  // 1) Matches dans la fenêtre et encore NS
  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select('id, date, status')
    .gte('date', start.toISOString())
    .lt('date', end.toISOString())
    .eq('status', MATCH_STATUS_NOT_STARTED);
  if (mErr) throw new Error(mErr.message);
  if (!matches?.length) return 0;

  const matchIds = matches.map(m => m.id);

  // 2) grid_matches pour ces matches (qui n'ont PAS de pick)
  const { data: gms, error: gmErr } = await supabase
    .from('grid_matches')
    .select('user_id, match_id, grid_id, competition_id, pick')
    .in('match_id', matchIds);
  if (gmErr) throw new Error(gmErr.message);
  if (!gms?.length) return 0;

  // Users sans pick pour chaque match
  const todoByMatch = new Map<number, Set<string>>();
  for (const r of gms) {
    if (r.pick == null) {
      if (!todoByMatch.has(r.match_id)) todoByMatch.set(r.match_id, new Set());
      todoByMatch.get(r.match_id)!.add(r.user_id);
    }
  }
  if (!todoByMatch.size) return 0;

  // Map match_id -> competition_id (depuis gms)
  const compByMatch = new Map<number, string | number>();
  for (const r of gms) {
    if (!compByMatch.has(r.match_id) && r.competition_id != null) {
      compByMatch.set(r.match_id, r.competition_id);
    }
  }

  // 3) Préférences ON (par défaut ON si pas de ligne)
  type PrefRow = {
    user_id: string;
    allow_match_reminder_24h: boolean | null;
    allow_match_reminder_1h:  boolean | null;
  };
  const { data: prefsRaw, error: prefErr } = await supabase
    .from('push_prefs')
    .select('user_id, allow_match_reminder_24h, allow_match_reminder_1h');
  if (prefErr) throw new Error(prefErr.message);
  const offSet = new Set(
    (prefsRaw || [])
      .filter(r => (kind === 'H24' ? r.allow_match_reminder_24h === false
                                   : r.allow_match_reminder_1h  === false))
      .map(r => r.user_id)
  );

  // 4) Déterminer les compétitions impliquées et calculer les "joueurs engagés"
  const compIds = Array.from(new Set((gms || [])
    .map(r => r.competition_id)
    .filter((v): v is string | number => v != null)));

  // (A) Engagement via CROIX (pick non NULL) dans ces compétitions
  const { data: played, error: playedErr } = await supabase
    .from('grid_matches')
    .select('user_id, competition_id')
    .in('competition_id', compIds)
    .not('pick', 'is', null);
  if (playedErr) throw new Error(playedErr.message);

  // (B) Engagement via BONUS : grid_bonus -> grids -> competition_id
  const { data: gridsMap, error: gridsErr } = await supabase
    .from('grids')
    .select('id, competition_id')
    .in('competition_id', compIds);
  if (gridsErr) throw new Error(gridsErr.message);

  const compByGrid = new Map<string | number, string | number>();
  for (const g of gridsMap || []) compByGrid.set(g.id, g.competition_id);

  const gridIds = Array.from(compByGrid.keys());
  let bonusPlayed: { user_id: string; grid_id: number | string }[] = [];
  if (gridIds.length) {
    const { data: bonusRows, error: bonusErr } = await supabase
      .from('grid_bonus')
      .select('user_id, grid_id')
      .in('grid_id', gridIds);
    if (bonusErr) throw new Error(bonusErr.message);
    bonusPlayed = bonusRows || [];
  }

  // Set "user_id|competition_id" des joueurs engagés (croix OU bonus)
  const engagedSet = new Set<string>();
  for (const r of played || []) {
    engagedSet.add(`${r.user_id}|${r.competition_id}`);
  }
  for (const r of bonusPlayed) {
    const cid = compByGrid.get(r.grid_id);
    if (cid != null) engagedSet.add(`${r.user_id}|${cid}`);
  }

  // 5) Tokens (priorité plateforme) + filtre only
  let tokensQuery = supabase
    .from('push_tokens')
    .select('token, user_id, platform, last_seen_at')
    .order('last_seen_at', { ascending: false, nullsFirst: false });
  if (only) tokensQuery = tokensQuery.eq('user_id', only);
  const { data: tokensRows, error: tErr } = await tokensQuery;
  if (tErr) throw new Error(tErr.message);

  // Helper priorité: une seule "famille" + 1 token (le plus récent) par user
  function pickPreferredTokensForUser(uid: string): string[] {
    const rows = (tokensRows || []).filter(r => r.user_id === uid);
    for (const p of PLATFORM_PRIORITY) {
      const subset = rows.filter(r => (r.platform as any) === p);
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
    const eligible = Array.from(users).filter(uid => {
      if (compId == null) return false;
      return engagedSet.has(`${uid}|${compId}`) && !offSet.has(uid);
    });
    if (!eligible.length) continue;

    for (const uid of eligible) {
      // dédup via push_log
      const ins = await supabase
        .from('push_log')
        .insert({ user_id: uid, kind, match_id: m.id, grid_id: null });
      if (ins.error) {
        const code = (ins.error as any).code || '';
        if (code === '23505') continue; // déjà envoyé récemment
        continue;
      }

      const userTokens = pickPreferredTokensForUser(uid);
      if (!userTokens.length) continue;

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
                icon:  '/images/notifications/icon-192x192.png',
                tag:   'peps-reminder'
              },
              fcmOptions: { link: 'https://www.peps-foot.com/' }
            }
          });
          sentCount++;
        } catch (e: any) {
          const msg = e?.errorInfo?.code || e?.message || '';
          if (String(msg).includes('registration-token-not-registered') ||
              String(msg).includes('invalid-argument')) {
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

/**
 * Grille terminée — notifie les participants (préférence ON),
 * en priorisant aussi l’appli.
 */
async function handleGridDone() {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);

  // 1) Grilles modifiées récemment (supposées "terminées" côté app quand tous les matches sont FT)
  const { data: grids, error: gErr } = await supabase
    .from('grids')
    .select('id, competition_id, updated_at')
    .gte('updated_at', windowStart.toISOString());
  if (gErr) throw new Error(gErr.message);
  if (!grids?.length) return 0;

  // 2) Vérifier qu’il n’y a plus de match NS dans ces grilles
  const { data: gmAll, error: gmaErr } = await supabase
    .from('grid_matches')
    .select('grid_id, match_id');
  if (gmaErr) throw new Error(gmaErr.message);

  const { data: mAll, error: mErr } = await supabase.from('matches').select('id, status');
  if (mErr) throw new Error(mErr.message);

  const statusByMatch = new Map(mAll?.map((m) => [m.id, m.status]) || []);
  const finishedGrids = new Set<number>();
  for (const g of grids) {
    const rows = (gmAll || []).filter((r) => r.grid_id === g.id);
    if (!rows.length) continue;
    const allFinished = rows.every((r) => statusByMatch.get(r.match_id) === MATCH_STATUS_FINISHED);
    if (allFinished) finishedGrids.add(g.id);
  }
  if (!finishedGrids.size) return 0;

  // 3) Participants des grilles finies
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

  // 4) Préférences allow_grid_done
  const { data: prefs, error: prefErr } = await supabase
    .from('push_prefs')
    .select('user_id, allow_grid_done');
  if (prefErr) throw new Error(prefErr.message);
  const offSet = new Set((prefs || []).filter((r) => r.allow_grid_done === false).map((r) => r.user_id));

  // 5) Tokens (avec plateforme) + helper de priorité
  const { data: tokensRows, error: tErr } = await supabase
    .from('push_tokens')
    .select('token, user_id, platform');
  if (tErr) throw new Error(tErr.message);

  function pickPreferredTokensForUser(uid: string): string[] {
    const rows = (tokensRows || []).filter((t) => t.user_id === uid);
    for (const p of PLATFORM_PRIORITY) {
      const subset = rows.filter((r) => (r.platform as any) === p).map((r) => r.token as string);
      if (subset.length) return subset;
    }
    return [];
  }

  // 6) Envoi
  let sentCount = 0;
  const toDelete = new Set<string>();

  for (const gridId of Array.from(finishedGrids)) {
    const users = Array.from(usersByGrid.get(gridId) || []).filter((uid) => !offSet.has(uid));
    for (const uid of users) {
      // dédup
      const { error: logErr } = await supabase
        .from('push_log')
        .upsert(
          { user_id: uid, kind: 'GRID_DONE', match_id: null, grid_id: gridId },
          { onConflict: 'user_id,kind,match_id,grid_id' },
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
        }),
      );
    }
  }

  if (toDelete.size) {
    await supabase.from('push_tokens').delete().in('token', Array.from(toDelete));
  }
  return sentCount;
}
