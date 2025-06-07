// src/app/[competitionId]/page.tsx

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import HomePageClient from '@/components/HomePageClient'
import type { Grid, Match, GridBonus, BonusDef } from '@/lib/types'

interface PageProps {
  params: { competitionId: string }
}

export default async function HomePage({ params }: PageProps) {
  const { competitionId } = params
  const supabase = createServerComponentClient({ cookies, headers })

  // 1) Récupère/force la session
  const {
    data: { session },
    error: errSession
  } = await supabase.auth.getSession()
  if (errSession) {
    console.error('❌ Auth getSession error:', errSession)
    throw errSession
  }
  if (!session) return redirect('/connexion')
  const userId = session.user.id

  // 2) Charge les grilles de cette compétition via competition_grids
  const { data: cgRows, error: errCg } = await supabase
    .from('competition_grids')
    .select(`
      grids (
        id,
        title,
        description,
        allowed_bonuses
      )
    `)
    .eq('competition_id', competitionId)
    .order('created_at', { ascending: true, foreignTable: 'grids' })
  if (errCg) {
    console.error('❌ Supabase error (competition_grids):', {
      code:    errCg.code,
      message: errCg.message,
      details: errCg.details,
      hint:    errCg.hint
    })
    throw errCg
  }

  const grids = cgRows?.map(r => r.grids) || []
  if (grids.length === 0) {
    return <main className="p-6 text-center">Aucune grille pour cette compétition.</main>
  }

  // 3) Sélectionne la première grille (ou ta logique “active grid”)
  const currentGrid = grids[0]

  // 4) Charge les pronostics de ce joueur pour cette grille
  const { data: picks, error: errPicks } = await supabase
    .from<Match>('grid_matches')
    .select('match_id,pick')
    .eq('grid_id', currentGrid.id)
    .eq('user_id', userId)
  if (errPicks) {
    console.error('❌ Supabase error (grid_matches):', {
      code:    errPicks.code,
      message: errPicks.message,
      details: errPicks.details,
      hint:    errPicks.hint
    })
    throw errPicks
  }

  // 5) Charge les bonus joués de ce joueur pour cette grille
  const { data: playerBonuses, error: errPb } = await supabase
    .from<GridBonus>('grid_bonus')
    .select('bonus_definition(name,code),parameters')
    .eq('grid_id', currentGrid.id)
    .eq('user_id', userId)
  if (errPb) {
    console.error('❌ Supabase error (grid_bonus):', {
      code:    errPb.code,
      message: errPb.message,
      details: errPb.details,
      hint:    errPb.hint
    })
    throw errPb
  }

  // 6) Définitions de bonus (globales)
  const { data: bonusDefs, error: errBd } = await supabase
    .from<BonusDef>('bonus_definition')
    .select('id,code,description')
  if (errBd) {
    console.error('❌ Supabase error (bonus_definition):', {
      code:    errBd.code,
      message: errBd.message,
      details: errBd.details,
      hint:    errBd.hint
    })
    throw errBd
  }

  // 7) Ton RPC compute_scores
  const { data: scoreRows, error: errScores } = await supabase
    .rpc('compute_scores', { p_grid_id: currentGrid.id })
  if (errScores) {
    console.error('❌ Supabase error (compute_scores RPC):', {
      code:    errScores.code,
      message: errScores.message,
      details: errScores.details,
      hint:    errScores.hint
    })
    throw errScores
  }
  const totalPoints = (scoreRows as { points?: number }[]).reduce(
    (sum, r) => sum + (r.points ?? 0),
    0
  )

  // 8) Passe tout au client
  return (
    <HomePageClient
      key={userId} 
      grids={grids}
      picks={picks ?? []}
      bonuses={playerBonuses ?? []}
      bonusDefs={bonusDefs ?? []}
      allowedBonuses={currentGrid.allowed_bonuses}
      userId={userId}
      scores={scoreRows ?? []}
      totalPoints={totalPoints}
    />
  )
}
