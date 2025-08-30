export const runtime = 'nodejs';

import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET() {
  // ⚠️ côté serveur uniquement → lit les cookies de session Supabase
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  return Response.json({ ok: true, user_id: user?.id ?? null });
}
