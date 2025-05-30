// pages/api/auth/signout.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  // On crée un client Supabase server-side pour gérer le cookie httpOnly
  const supabase = createPagesServerClient({ req, res })
  const { error } = await supabase.auth.signOut()

  // Autoriser "no session" comme cas de succès
  if (error && error.message !== 'Auth session missing!') {
    return res.status(500).json({ error: error.message })
  }

  // Tout est clean, cookie détruit
  return res.status(200).end()
}
