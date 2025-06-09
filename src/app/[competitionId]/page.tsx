import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Match, GridBonus, BonusDef } from '@/lib/types'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Grilles par compétition',
}

export default async function Page({ params }: { params: { competitionId: string } }) {
  const { competitionId } = params
  const supabase = createServerComponentClient({ cookies, headers })

  const {
    data: { session },
    error: errSession,
  } = await supabase.auth.getSession()
  if (errSession) throw errSession
  if (!session) return redirect('/connexion')
  const userId = session.user.id

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
  if (errCg) throw errCg

  const grids = cgRows?.map((r) => r.grids) || []
  if (grids.length === 0) {
    return <main className="p-6 text-center">Aucune grille pour cette compétition.</main>
  }

  const currentGrid = grids[0]

  const { data: picks, error: errPicks } = await supabase
    .from<Match>('grid_matches')
    .select('match_id,pick')
    .eq('grid_id', currentGrid.id)
    .eq('user_id', userId)
  if (errPicks) throw errPicks

  const { data: playerBonuses, error: errPb } = await supabase
    .from<GridBonus>('grid_bonus')
    .select('bonus_definition(name,code),parameters')
    .eq('grid_id', currentGrid.id)
    .eq('user_id', userId)
  if (errPb) throw errPb

  const { data: bonusDefs, error: errBd } = await supabase
    .from<BonusDef>('bonus_definition')
    .select('id,code,description')
  if (errBd) throw errBd

  const { data: scoreRows, error: errScores } = await supabase.rpc('compute_scores', {
    p_grid_id: currentGrid.id,
  })
  if (errScores) throw errScores

  const totalPoints = (scoreRows as { points?: number }[]).reduce(
    (sum, r) => sum + (r.points ?? 0),
    0
  )

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{currentGrid.title}</h1>
      <p className="mb-4 text-gray-600">{currentGrid.description}</p>

      <div className="mb-6">
        <h2 className="font-semibold text-lg mb-2">Points obtenus : {totalPoints}</h2>
        <ul className="list-disc list-inside text-sm">
          {scoreRows?.map((s, i) => (
            <li key={i}>{s.points} pts</li>
          ))}
        </ul>
      </div>

      <div className="mb-6">
        <h2 className="font-semibold text-lg mb-2">Pronostics joués</h2>
        <ul className="list-disc list-inside text-sm">
          {picks?.map((p) => (
            <li key={p.match_id}>
              Match {p.match_id} → <strong>{p.pick}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="font-semibold text-lg mb-2">Bonus utilisés</h2>
        <ul className="list-disc list-inside text-sm">
          {playerBonuses?.map((b, i) => (
            <li key={i}>
              {b.bonus_definition.code} — {JSON.stringify(b.parameters)}
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
