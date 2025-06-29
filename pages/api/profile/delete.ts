import { NextApiRequest, NextApiResponse } from 'next'
import { createServerClient } from '@supabase/ssr'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return req.cookies[name]
        },
        set(name, value, options) {
          res.setHeader('Set-Cookie', `${name}=${value}; Path=/; HttpOnly`)
        },
        remove(name) {
          res.setHeader('Set-Cookie', `${name}=; Path=/; Max-Age=0`)
        },
      },
    }
  )

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
