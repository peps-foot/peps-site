import { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  const supabase = createPagesServerClient({ req, res })

  // Récupère la session utilisateur
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return res.status(401).json({ error: 'Non connecté' })
  }

  const uid = session.user.id

  // 🔥 Étape 1 : Supprimer toutes les lignes liées à l'utilisateur
  const tables = ['grid_matches', 'grid_bonus', 'grid_items', 'grids']
  for (const table of tables) {
    await supabase.from(table).delete().eq('user_id', uid)
  }

  // 🔥 Étape 2 : Supprimer le profil
  await supabase.from('profiles').delete().eq('user_id', uid)

  // 🔥 Étape 3 : Supprimer l'utilisateur dans Supabase Auth
  const { error } = await supabase.auth.admin.deleteUser(uid)
  if (error) {
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ ok: true })
}
