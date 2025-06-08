// src/app/[competitionId]/page.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page({ params }: { params: { competitionId: string } }) {
  const supabase = createServerComponentClient({ cookies, headers });

  const {
    data: { session },
    error: errSession
  } = await supabase.auth.getSession();

  if (!session || errSession) {
    return redirect('/connexion');
  }

  const { competitionId } = params;

  return (
    <main>
      <h1>Compétition : {competitionId}</h1>
    </main>
  );
}
