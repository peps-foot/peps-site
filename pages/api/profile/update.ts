// pages/api/profile/update.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  // 1) Créer un client supabase server-side avec cookie
  const supabase = createPagesServerClient({ req, res })

  // 2) Récupérer l’UID de l’utilisateur
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    return res.status(401).json({ error: 'Auth session missing' })
  }

  const uid = session.user.id
  const { email, password, pseudo } = req.body as {
    email?: string
    password?: string
    pseudo?: string
  }

  // 3) Mettre à jour email et mot de passe
  if (email || password) {
    const { error } = await supabase.auth.updateUser({ email, password })
    if (error) return res.status(400).json({ error: error.message })
  }

  // 4) Mettre à jour (ou créer) le pseudo dans profiles
  if (pseudo !== undefined) {
    const { error } = await supabase
      .from('profiles')
      .upsert({ user_id: uid, username: pseudo }, { onConflict: 'user_id' })
    if (error) return res.status(400).json({ error: error.message })
  }

  return res.status(200).json({ ok: true })
}
