'use client'

import type { User } from '@supabase/supabase-js'
import type { Grid, Match, GridBonus, BonusDef, MatchWithOdds } from '@/lib/types'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { NavBar } from '@/components/NavBar'
import Image from 'next/image'

type CompetitionGridRow = { grids: Grid }

const bonusLogos: Record<string, string> = {
  KANTE: '/images/kante.png',
  RIBERY: '/images/ribery.png',
  ZLATAN: '/images/zlatan.png',
}

export default function CompetitionPage() {
  const params = useParams()
  const competitionId = params?.competitionId as string | undefined

  if (!competitionId) {
    return <main className="p-6">Compétition introuvable dans l’URL.</main>
  }
  const [user, setUser] = useState<User | null>(null)
  const [grids, setGrids] = useState<Grid[]>([])
  const [grid, setGrid] = useState<Grid | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [bonusDefs, setBonusDefs] = useState<BonusDef[]>([])
  const [gridBonuses, setGridBonuses] = useState<GridBonus[]>([])
  const [totalPoints, setTotalPoints] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)

  const hasRun = useRef(false)

  useEffect(() => {
    if (!competitionId || hasRun.current) return
    hasRun.current = true

    const fetchAll = async () => {
      const {
        data: { session },
        error: errSession,
      } = await supabase.auth.getSession()
      if (errSession || !session) {
        window.location.href = '/connexion'
        return
      }

      setUser(session.user)

      const { data: cgRows, error: errCg } = await supabase
        .from<CompetitionGridRow, CompetitionGridRow>('competition_grids')
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


      if (errCg || !cgRows?.length) return

      const current = cgRows?.[0]?.grids as Grid
      setGrids([current])
      setGrid(current)

      const { data: picks } = await supabase
        .from('grid_matches')
        .select('match_id, pick, points, matches(*)')
        .eq('grid_id', current.id)
        .eq('user_id', session.user.id)

      const matchList = picks?.map((m: any) => ({
        ...m.matches,
        match_id: m.match_id,
        pick: m.pick,
        points: m.points,
      })) ?? []

      setMatches(matchList)

      const { data: gbs } = await supabase
        .from('grid_bonus')
        .select('bonus_definition, match_id, parameters')
        .eq('grid_id', current.id)
        .eq('user_id', session.user.id)

      const { data: defs } = await supabase
        .from('bonus_definition')
        .select('id, code, description')

      const { data: scores } = await supabase.rpc('compute_scores', { p_grid_id: current.id })

      const total = (scores ?? []).reduce((sum: number, r: any) => sum + (r.points ?? 0), 0)

      setGridBonuses(gbs ?? [])
      setBonusDefs(defs ?? [])
      setTotalPoints(total)
      setLoading(false)
    }

    fetchAll()
  }, [competitionId])

  if (loading) {
    return <main className="p-6">Chargement des données de la compétition...</main>
  }

  return (
    <>
      <NavBar />
      <main className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">{grid?.title}</h1>
        <p className="mb-4 text-gray-600">{grid?.description}</p>
        <p className="mb-4 font-semibold">Total de points : {totalPoints}</p>

        <h2 className="text-lg font-bold mb-2">Pronostics</h2>
        <ul className="space-y-1 text-sm">
          {matches.map((m) => (
            <li key={m.id}>
              {m.home_team} vs {m.away_team} — <strong>{m.pick || '-'}</strong>{' '}
              {m.points != null && `(${m.points} pts)`}
            </li>
          ))}
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">Bonus</h2>
        <ul className="space-y-1 text-sm">
          {gridBonuses.map((b, i) => {
            const def = bonusDefs.find((d) => d.id === b.bonus_definition)
            return (
              <li key={i}>
                {def?.code ?? 'BONUS'} : {JSON.stringify(b.parameters)}
              </li>
            )
          })}
        </ul>
      </main>
    </>
  )
}
