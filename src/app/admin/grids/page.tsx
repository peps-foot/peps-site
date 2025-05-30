// src/app/admin/grids/page.tsx
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import AdminGridsClient from '@/components/AdminGridsClient'

type BonusDef = { id: string; code: string; name: string }
type Grid = {
  id: string
  title: string
  description: string | null
  created_at: string
  allowed_bonuses: string[]
}
export default async function AdminGridsPage() {
  // 1) Initialise Supabase côté serveur, avec HTTP-only cookies
  const supabase = createServerComponentClient({ cookies, headers })

  // 2) Récupère la session authentifiée
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // 3) Si pas connecté **ou** pas admin → on redirige
  if (!session || session.user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    redirect('/connexion')
  }

  // 4) Cherche l’ID de la catégorie MATCH (bonus_categories.name = 'MATCH')
  const { data: catRow } = await supabase
    .from<{ id: string }>('bonus_categories')
    .select('id')
    .eq('name', 'MATCH')
    .single()
  const catId = catRow?.id ?? ''

  // 5) Charge les définitions de bonus associées
  let bonusDefs: BonusDef[] = []
  if (catId) {
    const { data, error } = await supabase
      .from<BonusDef>('bonus_definition')
      .select('id,code,name')
      .eq('category_id', catId)
    if (data && !error) bonusDefs = data
  }

  // 6) Liste distincte des compétitions (pour le filtre ‘matches’)
  const { data: compsRows } = await supabase
    .from<{ competition: string }>('matches')
    .select('competition', { distinct: true })
  const competitions = compsRows?.map((r) => r.competition) ?? []

  // 7) Charge TOUTES les grilles existantes
  const { data: gridsRows } = await supabase
    .from<Grid>('grids')
    .select('id,title,description,created_at,allowed_bonuses')
    .order('created_at', { ascending: false })
  const grids = gridsRows ?? []

  // 8) On rend le Client Component en lui passant ces données
  return (
    <AdminGridsClient
      bonusDefs={bonusDefs}
      competitions={competitions}
      grids={grids}
    />
  )
}
