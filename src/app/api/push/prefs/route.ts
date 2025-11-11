// src/app/api/push/prefs/route.ts
export const runtime = 'nodejs';
import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Rôle:
 *  - GET  /api/push/prefs?user_id=...  → lit les préférences (ou renvoie des défauts si absent)
 *  - POST /api/push/prefs               → upsert des préférences pour user_id
 *
 * Body POST (JSON):
 *  {
 *    "user_id": "<uuid>",
 *    "prefs": {
 *      "allow_admin_broadcast": true|false,
 *      "allow_grid_done": true|false,
 *      "allow_match_reminder_24h": true|false,
 *      "allow_match_reminder_1h": true|false
 *    }
 *  }
 *
 * Note: clés Supabase en dur TEMPORAIRES (volontaire).
 */

const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const DEFAULTS = {
  allow_admin_broadcast: true,
  allow_grid_done: true,
  allow_match_reminder_24h: true,
  allow_match_reminder_1h: true,
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  if (!user_id) {
    return new Response(JSON.stringify({ ok: false, error: 'missing user_id' }), { status: 400 });
  }

  const { data, error } = await supabase
    .from('push_prefs')
    .select('*')
    .eq('user_id', user_id)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ ok: false, supabase_error: error.message }), { status: 500 });
  }

  return Response.json({ ok: true, prefs: data ?? { user_id, ...DEFAULTS } });
}

type PostBody = {
  user_id?: string;
  prefs?: Partial<typeof DEFAULTS>;
};

export async function POST(req: Request) {
  try {
    // lecture tolérante (évite les 400 dues à l’échappement PowerShell)
    const raw = await req.text();
    let body: PostBody = {};
    if (raw) {
      try { body = JSON.parse(raw); } catch {}
    }

    const user_id = body.user_id;
    const prefs = body.prefs;

    if (!user_id || !prefs) {
      return new Response(JSON.stringify({ ok: false, error: 'missing user_id/prefs' }), { status: 400 });
    }

    // On force des booléens explicites (!!…) et on exige les 4 champs (comportement “écrase tout”, comme ton original)
    const row = {
      user_id,
      allow_admin_broadcast: !!prefs.allow_admin_broadcast,
      allow_grid_done: !!prefs.allow_grid_done,
      allow_match_reminder_24h: !!prefs.allow_match_reminder_24h,
      allow_match_reminder_1h: !!prefs.allow_match_reminder_1h,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('push_prefs')
      .upsert(row, { onConflict: 'user_id' });

    if (error) {
      return new Response(JSON.stringify({ ok: false, supabase_error: error.message }), { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, route_error: e?.message || 'unknown' }), { status: 500 });
  }
}
