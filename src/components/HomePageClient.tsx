'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import type { Match, GridBonus, BonusDef } from '@/lib/types'

type Props = {
  competitionId: string
}

export default function HomePageClient({ competitionId }: Props) {
  const supabase = createBrowserSupabaseClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [grids, setGrids] = useState<any[]>([])
  const [picks, setPicks] = useState<Match[]>([])
  const [playerBonuses, setPlayerBonuses] = useState<GridBonus[]>([])
  const [bonusDefs, setBonusDefs] = useState<BonusDef[]>([])
  const [totalPoints, setTotalPoints] = useState<number>(0)

  useEffect(() => {
    const loadData = async () => {
      const { data: { session }, error: errSession } = await supabase.auth.getSession()

      if (errSession || !session) {
        router.push('/connexion')
        return
      }

      const userId = session.user.id
      setUserId(userId)

      // 1. Grilles de la compétition
      const { data: cgRows, error: errCg } = await supabase
        .from('competition_grids')
        .select(`grids ( id, title, description, allowed_bonuses )`)
        .eq('competition_id', competitionId)
        .order('created_at', { ascending: true, foreignTable: 'grids' })

      if (errCg) throw errCg
      const gridList = cgRows?.map(r => r.grids) ?? []
      setGrids(gridList)
      if (gridList.length === 0) return

      const currentGrid = gridList[0]

      // 2. Picks utilisateur
      const { data: picks, error: errPicks } = await supabase
        .from('grid_matches')
        .select('match_id, pick')
        .eq('grid_id', currentGrid.id)
        .eq('user_id', userId)
      if (errPicks) throw errPicks
      setPicks(picks ?? [])

      // 3. Bonus utilisateur
      const { data: bonusRows, error: errBonus } = await supabase
        .from('grid_bonus')
        .select('bonus_definition(name,code), parameters')
        .eq('grid_id', currentGrid.id)
        .eq('user_id', userId)
      if (errBonus) throw errBonus
      setPlayerBonuses(bonusRows ?? [])

      // 4. Défs de bonus globales
      const { data: defs, error: errDefs } = await supabase
        .from('bonus_definition')
        .select('id, code, description')
      if (errDefs) throw errDefs
      setBonusDefs(defs ?? [])

      // 5. Score via RPC
      const { data: scores, error: errScores } = await supabase
        .rpc('compute_scores', { p_grid_id: currentGrid.id })
      if (errScores) throw errScores
      const total = (scores ?? []).reduce((sum, r) => sum + (r.points ?? 0), 0)
      setTotalPoints(total)

      setLoading(false)
    }

    loadData().catch(err => {
      console.error('❌ Erreur de chargement :', err)
    })
  }, [competitionId])

  if (loading) return <p className="p-6 text-center">Chargement…</p>
  if (grids.length === 0) return <p className="p-6 text-center">Aucune grille pour cette compétition.</p>

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold mb-4">Compétition : {competitionId}</h1>
      <p>Grilles chargées : {grids.length}</p>
      <p>Points totaux : {totalPoints}</p>
      {/* Tu peux insérer ton rendu visuel ici */}
    </main>
  )
}
