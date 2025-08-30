export const runtime = 'nodejs';
import { messaging } from '../../../../lib/firebaseAdmin';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';        
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const only = searchParams.get('only');
  if (!only) {
    return Response.json({ ok: false, error: 'missing ?only=' });
  }

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token, user_id')
    .eq('user_id', only);

  if (!tokens?.length) {
    return Response.json({ ok: false, error: 'no tokens' });
  }

  let sent = 0;
  for (const t of tokens) {
    try {
      await messaging.send({
        token: t.token,
        webpush: {
          headers: { Urgency: 'high', TTL: '10' },
          data: {
            title: '🔔 TEST DIRECT',
            body: 'Ceci est un test direct FCM',
            url: 'https://www.peps-foot.com/',
            icon: '/icon-512x512.png',
            tag: 'peps-test'
          },
          fcmOptions: { link: 'https://www.peps-foot.com/' }
        }
      });
      sent++;
    } catch (e:any) {
      console.error('[TEST send error]', e?.errorInfo?.code || e?.message);
    }
  }

  return Response.json({ ok: true, sent });
}
