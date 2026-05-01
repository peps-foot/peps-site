// Envoi direct à un user_id précis.
// Supporte FCM (Android/web) et Web Push natif (iOS).

export const runtime = 'nodejs';
import 'server-only';
import { messaging } from '../../../../lib/firebaseAdmin';
import { createClient } from '@supabase/supabase-js';

const webpush = require('web-push') as typeof import('web-push');

const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const VAPID_PUBLIC_KEY  = 'BIIjmxt6CvJjd8EiHDtyBWgIvoDKO7eUjNJ_7FuN7vonLqolOVeWeilCoE2jIpeyN6Y02PZJ87B5MPRuywucWZE';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'aDNoUdMC-E95kgkI4qI-HL76jvvybdFU7vBDxTgoW-0';

webpush.setVapidDetails(
  'mailto:hello@peps-foot.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

/** Un token iOS est un JSON stringifié avec un endpoint Apple */
function isIosToken(token: string): boolean {
  try {
    const parsed = JSON.parse(token);
    return typeof parsed.endpoint === 'string' && parsed.endpoint.includes('apple.com');
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const only = searchParams.get('only');
  if (!only) {
    return Response.json({ ok: false, error: 'missing ?only=' });
  }

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token, user_id, platform')
    .eq('user_id', only);

  if (!tokens?.length) {
    return Response.json({ ok: false, error: 'no tokens for this user_id' });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const t of tokens) {
    const token = t.token as string;

    // ── iOS : Web Push natif ──
    if (isIosToken(token)) {
      try {
        const sub = JSON.parse(token) as {
          endpoint: string;
          keys: { p256dh: string; auth: string };
        };
        await webpush.sendNotification(
          sub,
          JSON.stringify({
            // Pas de bloc "notification" → évite le doublon natif Apple
            data: { title: '🔔 TEST DIRECT', body: 'Ceci est un test direct iOS (Web Push)', icon: '/images/notifications/peps-notif-icon-192.png', url: 'https://www.peps-foot.com/', tag: 'peps-test' },
          }),
          { urgency: 'high', TTL: 10 }
        );
        sent++;
      } catch (e: any) {
        const msg = `[iOS] ${e?.statusCode || ''} ${e?.message || String(e)}`;
        console.error('[TEST send error]', msg);
        errors.push(msg);
      }
      continue;
    }

    // ── Android / web / twa : FCM ──
    try {
      await messaging.send({
        token,
        webpush: {
          headers: { Urgency: 'high', TTL: '10' },
          // Pas de bloc notification — le SW affiche via onBackgroundMessage
          data: { title: '🔔 TEST DIRECT', body: 'Ceci est un test direct FCM', icon: '/images/notifications/peps-notif-icon-192.png', url: 'https://www.peps-foot.com/', tag: 'peps-test' },
        },
      });
      sent++;
    } catch (e: any) {
      const msg = `[FCM] ${e?.errorInfo?.code || e?.message || String(e)}`;
      console.error('[TEST send error]', msg);
      errors.push(msg);
    }
  }

  return Response.json({
    ok: true,
    sent,
    total: tokens.length,
    errors: errors.length ? errors : undefined,
  });
}