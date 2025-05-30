// src/app/page.tsx

// 1) Imports serveur
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

// 2) Import du Client Component interactif
import HomePageClient from '@/components/HomePageClient'

// 3) Types (si tu les as dans un fichier, importe-les de là au lieu de redéfinir)
interface Grid {
  id: string
  title: string
  description: string
  allowed_bonuses: string[]
}
interface Match {
  match_id: string
  pick: string
}
interface GridBonus {
  bonus_definition: { name: string; code: string }
  parameters: any
}
interface BonusDef {
  id: string
  code: string
  description: string
}

export default async function HomePage() {
  // ——— 1) Supabase server-side (cookies HTTP-only) ———
  const supabase = createServerComponentClient({ cookies, headers })

  // ——— 2) Récupère la session, redirige si non connecté ———
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return redirect('/connexion')
  const userId = session.user.id

  // ——— 3) Charge toutes les grilles ———
  const { data: grids, error: errGrids } = await supabase
    .from<Grid>('grids')
    .select('id,title,description,allowed_bonuses')
    .order('created_at')
  if (errGrids) throw errGrids
  console.log('▶ allowed_bonuses on server:', grids.map(g => g.allowed_bonuses))

  // Prends la première grille (ou ta logique)
  const currentGrid = grids[0]!

  // ——— 4) Charge les pronostics (grid_matches) ———
  const { data: picks, error: errPicks } = await supabase
    .from<Match>('grid_matches')
    .select('match_id,pick')
    .eq('grid_id', currentGrid.id)
    .eq('user_id', userId)
  if (errPicks) throw errPicks

  // ——— 5) Charge les bonus joués (grid_bonus) ———
  const { data: bonuses, error: errBonuses } = await supabase
    .from<GridBonus>('grid_bonus')
    .select('bonus_definition(name,code),parameters')
    .eq('grid_id', currentGrid.id)
    .eq('user_id', userId)
  if (errBonuses) throw errBonuses

  // ——— 6) Charge les définitions de bonus (bonus_definition) ———
  const { data: bonusDefs, error: errBonusDefs } = await supabase
    .from<BonusDef>('bonus_definition')
    .select('id,code,description')
  if (errBonusDefs) throw errBonusDefs

  // ——— 7) Passe tout au Client Component ———
  return (
    <HomePageClient
      grids={grids}
      currentGrid={currentGrid}
      picks={picks ?? []}
      bonuses={bonuses ?? []}
      bonusDefs={bonusDefs ?? []}
      allowedBonuses={currentGrid.allowed_bonuses}
    />
  )
}
