// app/api/push/unsubscribe/route.ts
export const runtime = 'nodejs';
import 'server-only';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';        
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export async function POST(req: Request) {
  const { token } = await req.json();
  if (!token) return new Response(JSON.stringify({ ok: false, error: 'missing token' }), { status: 400 });

  const { error } = await supabase.from('push_tokens').delete().eq('token', token);
  if (error) return new Response(JSON.stringify({ ok: false, supabase_error: error.message }), { status: 500 });

  return Response.json({ ok: true });
}
