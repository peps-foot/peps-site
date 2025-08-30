// app/api/push/broadcast/route.ts
export const runtime = 'nodejs';
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { messaging } from '../../../../lib/firebaseAdmin';

// ⚠️ À sécuriser plus tard via variables d'environnement
const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type Payload = {
  title: string;
  body: string;
  url?: string;
  platform?: 'web' | 'twa' | 'ios' | 'android' | 'all';
};

export async function POST(req: Request) {
  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'JSON invalide' }), { status: 400 });
  }

  const { title, body, url = 'https://www.peps-foot.com/', platform = 'all' } = payload;

  if (!title || !body) {
    return new Response(JSON.stringify({ ok: false, error: 'title/body requis' }), { status: 400 });
  }

  // 1) Récup tokens (avec filtre platform éventuel)
    let q = supabase.from('push_tokens').select('token, user_id');
    if (platform !== 'all') q = q.eq('platform', platform);
    const { data: tokenRows, error } = await q;
    if (error) return new Response(JSON.stringify({ ok:false, supabase_error:error.message }), { status: 500 });

    // Users qui ont explicitement désactivé les messages ponctuels admin
    const { data: disallowed } = await supabase
    .from('push_prefs')
    .select('user_id')
    .eq('allow_admin_broadcast', false);

    const blocked = new Set((disallowed || []).map(r => r.user_id));

    // On garde les tokens:
    // - sans user_id (anciens, tolérés), ou
    // - user_id non bloqué
    const tokens = (tokenRows || [])
    .filter(r => !r.user_id || !blocked.has(r.user_id))
    .map(r => r.token);

    if (!tokens.length) {
    return new Response(JSON.stringify({ ok:false, error:'no tokens (filtered)' }), { status: 404 });
    }

  // 2) Envoi par lots (uniquement DATA → le SW affichera UNE notif)
  const toDelete = new Set<string>();
  const sendOne = async (t: string) => {
    try {
      await messaging.send({
        token: t,
        webpush: {
          headers: {
            Urgency: 'high',
            TTL: '10',
          },
          // ❌ PAS de "notification" ici pour éviter le double affichage
          data: {
            title,
            body,
            url,
            icon: '/icon-512x512.png',
            tag: 'peps-broadcast',
          },
          fcmOptions: { link: url },
        },
      });
      return true;
    } catch (e: any) {
      const msg = e?.errorInfo?.code || e?.message || '';
      if (
        String(msg).includes('registration-token-not-registered') ||
        String(msg).includes('invalid-argument')
      ) {
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
