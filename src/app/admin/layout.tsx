// src/app/admin/layout.tsx
import { ReactNode } from 'react'
import { cookies, headers } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  // 1) Instancie le client Supabase server-side
  const supabase = createServerComponentClient({ cookies, headers })

  // 2) Récupère la session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // 3) Si pas de session ou pas admin → redirection immédiate
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@peps.foot'
  if (!session || session.user.email !== adminEmail) {
    redirect('/connexion')
  }

  // 4) Sinon, on rend les enfants de la page admin
  return (
    <div className="font-sans antialiased bg-white text-gray-900 min-h-screen p-6">
      {children}
    </div>
  )
}
