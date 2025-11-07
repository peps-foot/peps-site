// ⚠️ Version provisoire avec clés en dur (à remplacer par variables d'env dès que possible)
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** ==== RENSEIGNE ICI TES CLÉS PROVISOIRES ==== */
const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';            // ← remplace par ton URL Supabase
const SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';                    // ← remplace par ta Service Role Key
const CRON_KEY     = 'snap_peps_2025_secret';              // ← choisis une chaîne aléatoire

export async function GET(request: Request) {
  try {
    // mini protection : clé dans l’URL ?key=...
    const url = new URL(request.url);
    const k = url.searchParams.get('key');
    if (k !== CRON_KEY) {
      return new Response('forbidden', { status: 403 });
    }

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response('missing hardcoded keys', { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // appelle la fonction SQL qui prend la “photo incrémentale”
    const { error } = await supabase.rpc('snapshot_incremental_picks_and_bonuses');
    if (error) {
      return new Response('error: ' + error.message, { status: 500 });
    }

    return new Response('ok');
  } catch (e: any) {
    return new Response('error: ' + (e?.message || 'unknown'), { status: 500 });
  }
}
