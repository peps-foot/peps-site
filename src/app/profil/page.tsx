// src/app/profil/page.tsx
import React from 'react'
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import ProfilForm from '@/components/ProfilForm'

export default async function ProfilPage() {
  const supabase = createServerComponentClient({ cookies, headers });
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/connexion')
  }

  const { data: profile, error } = await supabase
    .from<{ username: string }>('profiles')
    .select('username')
    .eq('user_id', session.user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Erreur chargement profil :', error)
  }

  return (
    <ProfilForm
      initialEmail={session.user.email}
      initialPseudo={profile?.username || ''}
    />
  )
}
