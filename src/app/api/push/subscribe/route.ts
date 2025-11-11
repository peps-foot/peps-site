// src/app/api/push/subscribe/route.ts
export const runtime = 'nodejs';
import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Rôle: enregistrer/mettre à jour un token FCM dans push_tokens.
 * Entrée JSON (POST):
 *   { token: string, platform?: 'web'|'twa'|'ios'|'android', user_id?: string|null }
 * Règles:
 *   - Si le token existe déjà:
 *       - Si user_id est fourni → on (ré)assigne au user_id + MAJ platform/last_seen_at
 *       - Sinon → on ne touche PAS au user_id existant (seulement platform/last_seen_at)
 *   - Si le token n'existe pas → insertion (user_id peut être null)
 *
 * Notes:
 *   - Conçu pour être idempotent (pas d'erreur si on rappelle avec le même token)
 *   - UNIQUE(token) recommandé côté BDD
 */

// ⚠️ clés en dur TEMPORAIRES, comme demandé
const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type Body = {
  token?: string;
  platform?: 'web' | 'twa' | 'ios' | 'android';
  user_id?: string | null;
};

export async function POST(req: Request) {
  try {
    // lecture "sûre" du JSON (évite les 400 bêtes si le client envoie un body vide)
    const raw = await req.text();
    let body: Body = {};
    if (raw) {
      try { body = JSON.parse(raw); } catch { /* on laisse body = {} pour renvoyer une 400 propre */ }
    }

    const token = body.token?.trim();
    const platform = (body.platform || 'web') as Body['platform'];
    const user_id = body.user_id ?? null;

    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: 'missing token' }), { status: 400 });
    }

    // 1) Existe déjà ?
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
      // 2) Déjà en base
      if (user_id) {
        const { error } = await supabase
          .from('push_tokens')
          .update({ user_id, platform, last_seen_at: nowIso })
          .eq('token', token);
        if (error) return new Response(JSON.stringify({ ok: false, supabase_error: error.message }), { status: 500 });
      } else {
        const { error } = await supabase
          .from('push_tokens')
          .update({ platform, last_seen_at: nowIso })
          .eq('token', token);
        if (error) return new Response(JSON.stringify({ ok: false, supabase_error: error.message }), { status: 500 });
      }
    } else {
      // 3) Nouvelle ligne
      const { error } = await supabase
        .from('push_tokens')
        .insert({ token, platform, user_id, last_seen_at: nowIso });
      if (error) return new Response(JSON.stringify({ ok: false, supabase_error: error.message }), { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, route_error: e?.message || 'unknown' }), { status: 500 });
  }
}
