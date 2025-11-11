// src/app/api/push/broadcast/route.ts
export const runtime = 'nodejs';
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { messaging } from '../../../../lib/firebaseAdmin';

// ⚠️ Clés en dur TEMPORAIRES (comme demandé)
const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

type Platform = 'web' | 'twa' | 'ios' | 'android' | 'all';

type Payload = {
  title: string;
  body: string;
  url?: string;
  platform?: Platform;   // filtre explicite
  preferApp?: boolean;   // si true (par défaut) et platform=all → priorise twa/android par user
};

const PLATFORM_PRIORITY: Platform[] = ['twa', 'android', 'web', 'ios'];

export async function POST(req: Request) {
  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'JSON invalide' }), { status: 400 });
  }

  const {
    title,
    body,
    url = 'https://www.peps-foot.com/',
    platform = 'all',
    preferApp = true, // ⬅️ on active la priorité appli par défaut
  } = payload;

  if (!title || !body) {
    return new Response(JSON.stringify({ ok: false, error: 'title/body requis' }), { status: 400 });
  }

  // 1) Récup tokens (+ platform) avec éventuel filtre
  let q = supabase.from('push_tokens').select('token, user_id, platform').order('last_seen_at', { ascending: false, nullsFirst: false });
  if (platform !== 'all') q = q.eq('platform', platform);
  const { data: tokenRows, error } = await q;
  if (error) return new Response(JSON.stringify({ ok: false, supabase_error: error.message }), { status: 500 });

  // Users qui ont explicitement désactivé les messages admin ponctuels
  const { data: disallowed } = await supabase
    .from('push_prefs')
    .select('user_id')
    .eq('allow_admin_broadcast', false);

  const blocked = new Set((disallowed || []).map(r => r.user_id as string));

  // 2) Construction de la liste finale
  // - tokens sans user_id: gardés tels quels (impossible de dédupliquer par user)
  // - tokens avec user_id: si platform=all et preferApp=true → on ne garde que la 1re famille dispo selon la priorité
  //                        si platform≠all → on déduplique par user (1..n tokens possibles, tous dans la même plateforme)

  const withUid = new Map<string, { token: string; platform: Platform }[]>();
  const anonTokens: string[] = [];

  for (const r of tokenRows || []) {
    const uid = r.user_id as string | null;
    const plat = (r.platform as Platform) || 'web';
    if (uid) {
      if (blocked.has(uid)) continue; // respect prefs
      if (!withUid.has(uid)) withUid.set(uid, []);
      withUid.get(uid)!.push({ token: r.token as string, platform: plat });
    } else {
      anonTokens.push(r.token as string);
    }
  }

  function pickForUser(rows: { token: string; platform: Platform }[]): string[] {
    if (platform === 'all' && preferApp) {
      // priorité twa → android → web → ios
      for (const p of PLATFORM_PRIORITY) {
        const subset = rows.filter(r => r.platform === p).map(r => r.token);
        if (subset.length) return subset; // renvoie seulement cette famille
      }
      return [];
    } else {
      // soit platform=all mais preferApp=false (tout envoyer),
      // soit platform explicite: ne renvoyer que les tokens de cette plateforme (mais on a déjà filtré SQL)
      return rows.map(r => r.token);
    }
  }

  // Assemble la liste finale unique
  const selected: string[] = [];
  for (const [, rows] of withUid) {
    const chosen = pickForUser(rows);
    if (chosen.length) selected.push(...chosen);
  }
  // Ajoute les anonymes (pas de user_id)
  selected.push(...anonTokens);

  // petit dédoublonnage de sûreté
  const tokens = Array.from(new Set(selected));
  if (!tokens.length) {
    return new Response(JSON.stringify({ ok: false, error: 'no tokens (filtered)' }), { status: 404 });
  }

  // 3) Envoi data-only (le SW/FG affichera UNE notif)
  const toDelete = new Set<string>();
  const sendOne = async (t: string) => {
    try {
      await messaging.send({
        token: t,
        webpush: {
          headers: { Urgency: 'high', TTL: '10' },
          // ❌ PAS de "notification" ici pour éviter le double affichage
          data: { title, body, url, icon: '/icon-512x512.png', tag: 'peps-broadcast' },
          fcmOptions: { link: url },
        },
      });
      return true;
    } catch (e: any) {
      const msg = e?.errorInfo?.code || e?.message || '';
      if (String(msg).includes('registration-token-not-registered') || String(msg).includes('invalid-argument')) {
        toDelete.add(t);
      }
      return false;
    }
  };

  const BATCH = 50;
  for (let i = 0; i < tokens.length; i += BATCH) {
    await Promise.all(tokens.slice(i, i + BATCH).map(sendOne));
  }

  if (toDelete.size) {
    await supabase.from('push_tokens').delete().in('token', Array.from(toDelete));
  }

  return Response.json({ ok: true, sent_to: tokens.length, removed: toDelete.size });
}
