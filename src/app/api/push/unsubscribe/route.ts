// src/app/api/push/unsubscribe/route.ts
export const runtime = 'nodejs';
import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Rôle: supprimer un token FCM de push_tokens.
 * Entrée JSON (POST): { token: string }
 * Retour: { ok: true } ou erreur JSON/supabase
 *
 * Remarque: clés Supabase en dur TEMPORAIRES (volontaire).
 */
const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type Body = { token?: string };

export async function POST(req: Request) {
  try {
    // lecture "tolérante" pour éviter les 400 dues au quoting
    const raw = await req.text();
    let body: Body = {};
    if (raw) { try { body = JSON.parse(raw); } catch {} }

    const token = body.token?.trim();
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: 'missing token' }), { status: 400 });
    }

    const { error } = await supabase.from('push_tokens').delete().eq('token', token);
    if (error) {
      return new Response(JSON.stringify({ ok: false, supabase_error: error.message }), { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, route_error: e?.message || 'unknown' }), { status: 500 });
  }
}
