// app/api/push/subscribe/route.ts
export const runtime = 'nodejs';
import 'server-only';
import { createClient } from '@supabase/supabase-js';

// ⬇️ Tes clés en DUR (temporaire, local)
const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';        
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export async function POST(req: Request) {
  try {
    const { token, platform = 'web', user_id = null } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: 'missing token' }), { status: 400 });
    }

    // 1) On regarde s'il existe déjà une ligne pour ce token
    const { data: existing, error: selErr } = await supabase
      .from('push_tokens')
      .select('user_id')
      .eq('token', token)
      .maybeSingle();

    if (selErr) {
      return new Response(JSON.stringify({ ok: false, supabase_error: selErr.message }), { status: 500 });
    }

    const nowIso = new Date().toISOString();

    if (existing) {
      // 2) La ligne existe déjà
      if (user_id) {
        // ➜ on peut lier au user (et MAJ last_seen_at / platform)
        const { error } = await supabase
          .from('push_tokens')
          .update({ user_id, platform, last_seen_at: nowIso })
          .eq('token', token);
        if (error) return new Response(JSON.stringify({ ok: false, supabase_error: error.message }), { status: 500 });
      } else {
        // ➜ PAS de user_id fourni : on NE TOUCHE PAS au user_id existant
        const { error } = await supabase
          .from('push_tokens')
          .update({ platform, last_seen_at: nowIso })
          .eq('token', token);
        if (error) return new Response(JSON.stringify({ ok: false, supabase_error: error.message }), { status: 500 });
      }
    } else {
      // 3) Pas de ligne : on insère (user_id peut être null au 1er passage)
      const { error } = await supabase
        .from('push_tokens')
        .insert({ token, platform, user_id: user_id || null, last_seen_at: nowIso });
      if (error) return new Response(JSON.stringify({ ok: false, supabase_error: error.message }), { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, route_error: e?.message || 'unknown' }), { status: 500 });
  }
}


