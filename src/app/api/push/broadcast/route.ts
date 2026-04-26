// src/app/api/push/broadcast/route.ts
export const runtime = 'nodejs';
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { messaging } from '../../../../lib/firebaseAdmin';

// web-push : import en require pour éviter les problèmes ESM/CJS avec Next.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push') as typeof import('web-push');

// ⚠️ Clés en dur TEMPORAIRES (comme demandé)
const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── Clés VAPID (les mêmes que pour FCM côté client) ──
// VAPID_PUBLIC_KEY : la même clé que dans firebaseClient.ts
// VAPID_PRIVATE_KEY : à récupérer dans la console Firebase → Paramètres du projet → Cloud Messaging → Clés VAPID
// En attendant de la mettre dans .env, tu peux la mettre en dur ici temporairement.
const VAPID_PUBLIC_KEY = 'BIIjmxt6CvJjd8EiHDtyBWgIvoDKO7eUjNJ_7FuN7vonLqolOVeWeilCoE2jIpeyN6Y02PZJ87B5MPRuywucWZE';
// ⚠️ À REMPLIR : ta clé privée VAPID (différente de la clé Firebase Admin)
// Pour la récupérer : va sur https://console.firebase.google.com → ton projet → Paramètres → Cloud Messaging
// → Web Push certificates → la clé privée associée à ta clé publique VAPID
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'REMPLACE_PAR_TA_CLE_PRIVEE_VAPID';

webpush.setVapidDetails(
  'mailto:contact@peps-foot.com', // remplace par ton email admin
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

type Platform = 'web' | 'twa' | 'ios' | 'android' | 'all';

type Payload = {
  title: string;
  body: string;
  url?: string;
  platform?: Platform;
  preferApp?: boolean;
  icon?: string;
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
    preferApp = true,
    icon,
  } = payload;

  if (!title || !body) {
    return new Response(JSON.stringify({ ok: false, error: 'title/body requis' }), { status: 400 });
  }

  // 1) Récup tokens
  let q = supabase.from('push_tokens').select('token, user_id, platform').order('last_seen_at', { ascending: false, nullsFirst: false });
  if (platform !== 'all') q = q.eq('platform', platform);
  const { data: tokenRows, error } = await q;
  if (error) return new Response(JSON.stringify({ ok: false, supabase_error: error.message }), { status: 500 });

  // Users qui ont désactivé les broadcasts
  const { data: disallowed } = await supabase
    .from('push_prefs')
    .select('user_id')
    .eq('allow_admin_broadcast', false);
  const blocked = new Set((disallowed || []).map(r => r.user_id as string));

  // 2) Construction de la liste
  const withUid = new Map<string, { token: string; platform: Platform }[]>();
  const anonTokens: { token: string; platform: Platform }[] = [];

  for (const r of tokenRows || []) {
    const uid = r.user_id as string | null;
    const plat = (r.platform as Platform) || 'web';
    if (uid) {
      if (blocked.has(uid)) continue;
      if (!withUid.has(uid)) withUid.set(uid, []);
      withUid.get(uid)!.push({ token: r.token as string, platform: plat });
    } else {
      anonTokens.push({ token: r.token as string, platform: plat });
    }
  }

  function pickForUser(rows: { token: string; platform: Platform }[]): { token: string; platform: Platform }[] {
    if (platform === 'all' && preferApp) {
      for (const p of PLATFORM_PRIORITY) {
        const subset = rows.filter(r => r.platform === p);
        if (subset.length) return subset;
      }
      return [];
    }
    return rows;
  }

  const selected: { token: string; platform: Platform }[] = [];
  for (const [, rows] of withUid) {
    selected.push(...pickForUser(rows));
  }
  selected.push(...anonTokens);

  // Dédoublonnage par token
  const seen = new Set<string>();
  const tokens = selected.filter(r => { if (seen.has(r.token)) return false; seen.add(r.token); return true; });

  if (!tokens.length) {
    return new Response(JSON.stringify({ ok: false, error: 'no tokens (filtered)' }), { status: 404 });
  }

  // 3) Envoi — FCM pour android/web/twa, web-push natif pour iOS
  const toDelete = new Set<string>();
  const notifPayload = JSON.stringify({ title, body, icon: icon || '/images/notifications/peps-notif-icon-192.png', url, tag: 'peps-broadcast' });

  const sendOne = async (row: { token: string; platform: Platform }) => {
    const { token: t, platform: plat } = row;

    if (plat === 'ios') {
      // ── iOS : Web Push Protocol standard ──
      try {
        // Le token iOS est un JSON stringifié de PushSubscription
        const sub = JSON.parse(t) as { endpoint: string; keys: { p256dh: string; auth: string } };
        await webpush.sendNotification(
          sub,
          notifPayload,
          { urgency: 'high', TTL: 10 }
        );
        return true;
      } catch (e: any) {
        const status = e?.statusCode || e?.status;
        // 404 ou 410 = subscription expirée → on supprime
        if (status === 404 || status === 410) toDelete.add(t);
        return false;
      }
    } else {
      // ── Android / web / twa : FCM ──
      try {
        await messaging.send({
          token: t,
          webpush: {
            headers: { Urgency: 'high', TTL: '10' },
            data: {
              title, body, url,
              icon: icon || '/images/notifications/peps-notif-icon-192.png',
              tag: 'peps-broadcast',
            },
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
