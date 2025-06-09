'use client'

import { useEffect, useState } from 'react'
import { NavBar } from '@/components/NavBar'
import { User } from '@supabase/auth-helpers-nextjs'

type LeaderboardRow = {
  user_id: string
  username: string
  total_points: number
  rank: number
}

type Grid = {
  id: string
  title: string
}

type RawGridRow = {
  grid_id: string
  grids: {
    title: string
  } | null
}

export default function ClassementPage() {
  const [user, setUser] = useState<User | null>(null)
  const [competitionId, setCompetitionId] = useState<string | null>(null)
  const [grids, setGrids] = useState<Grid[]>([])
  const [currentGridIndex, setCurrentGridIndex] = useState(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [isGeneralView, setIsGeneralView] = useState(true)
  const [myRank, setMyRank] = useState<number | null>(null)
  const [totalPlayers, setTotalPlayers] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const initAndLoad = async () => {
      const { createBrowserSupabaseClient } = await import('@supabase/auth-helpers-nextjs')
      const supabase = createBrowserSupabaseClient()
      console.log('✅ ENV_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!user || error) return
      setUser(user)

      const { data: comp } = await supabase
        .from('competitions')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!comp?.id) return
      setCompetitionId(comp.id)

      const { data: gridsData } = await supabase
        .from('competition_grids')
        .select('grid_id, grids(title)')
        .eq('competition_id', comp.id)

      const parsed = (gridsData as RawGridRow[] | null)?.map((g) => ({
        id: g.grid_id,
        title: g.grids?.title ?? 'Grille',
      })) || []

      setGrids(parsed)

      fetchGeneralLeaderboard(user, comp.id)
    }

    initAndLoad()
  }, [])

  useEffect(() => {
    if (!user || isGeneralView || grids.length === 0) return
    const grid = grids[currentGridIndex]
    fetchLeaderboardByGrid(user, grid.id)
  }, [currentGridIndex, isGeneralView, grids, user])

  const fetchGeneralLeaderboard = async (u: User, compId: string) => {
    setLoading(true)
    setLeaderboard([])
    setMyRank(null)

    const { createBrowserSupabaseClient } = await import('@supabase/auth-helpers-nextjs')
    const supabase = createBrowserSupabaseClient()
    const { data } = await supabase.rpc('get_leaderboard_general', {
      p_competition_id: compId,
    })
    setLoading(false)

    if (!data) return
    const rows = data as LeaderboardRow[]
    setLeaderboard(rows)
    setTotalPlayers(rows.length)
    const rank = rows.find((r) => r.user_id === u.id)?.rank ?? null
    setMyRank(rank)
  }

  const fetchLeaderboardByGrid = async (u: User, gridId: string) => {
    setLoading(true)
    setLeaderboard([])
    setMyRank(null)

    const { createBrowserSupabaseClient } = await import('@supabase/auth-helpers-nextjs')
    const supabase = createBrowserSupabaseClient()
    const { data } = await supabase.rpc('get_leaderboard_by_grid', {
      p_grid_id: gridId,
    })
    setLoading(false)

    if (!data) return
    const rows = data as LeaderboardRow[]
    setLeaderboard(rows)
    setTotalPlayers(rows.length)
    const rank = rows.find((r) => r.user_id === u.id)?.rank ?? null
    setMyRank(rank)
  }

  const handleNextGrid = () => {
    setCurrentGridIndex((prev) => Math.min(prev + 1, grids.length - 1))
  }

  const handlePrevGrid = () => {
    setCurrentGridIndex((prev) => Math.max(prev - 1, 0))
  }

  return (
    <div className="min-h-screen bg-white px-4">
      <NavBar />

      <div className="flex justify-center mt-6 gap-4">
        <button
          className={`border px-4 py-1 rounded ${isGeneralView ? 'bg-black text-white' : ''}`}
          onClick={() => {
            if (!user || !competitionId) return
            setIsGeneralView(true)
            setLeaderboard([])
            setMyRank(null)
            fetchGeneralLeaderboard(user, competitionId)
          }}
        >
          GENERAL
        </button>
        <button
          className={`border px-4 py-1 rounded ${!isGeneralView ? 'bg-black text-white' : ''}`}
          onClick={() => {
            if (!user || grids.length === 0) return
            setIsGeneralView(false)
            setLeaderboard([])
            setMyRank(null)
            fetchLeaderboardByGrid(user, grids[currentGridIndex].id)
          }}
        >
          PAR GRILLE
        </button>
      </div>

      {!isGeneralView && grids.length > 0 && (
        <div className="flex justify-center items-center gap-4 my-6 text-xl font-bold">
          <button
            onClick={handlePrevGrid}
            disabled={currentGridIndex === 0}
            className="text-white rounded-full w-10 h-10 flex items-center justify-center"
            style={{ backgroundColor: currentGridIndex === 0 ? '#ccc' : '#212121' }}
          >
            &lt;
          </button>
          {grids[currentGridIndex].title}
          <button
            onClick={handleNextGrid}
            disabled={currentGridIndex === grids.length - 1}
            className="text-white rounded-full w-10 h-10 flex items-center justify-center"
            style={{ backgroundColor: currentGridIndex === grids.length - 1 ? '#ccc' : '#212121' }}
          >
            &gt;
          </button>
        </div>
      )}

      {!loading && myRank !== null && (
        <div className="text-center text-base font-medium text-gray-800 my-6">
          Tu es <strong>{myRank}</strong>
          <span className="ml-1 align-super">{myRank === 1 ? 'er' : 'e'}</span>
          {' '}sur <strong>{totalPlayers}</strong> joueur{totalPlayers > 1 ? 's' : ''}
        </div>
      )}

      {loading && (
        <p className="text-center text-sm text-gray-500 my-4">Chargement...</p>
      )}

      {!loading && leaderboard.length > 0 && (
        <div className="max-w-2xl mx-auto">
          <table className="w-full bg-white shadow rounded-lg overflow-hidden text-sm">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Position</th>
                <th className="text-left px-4 py-3">Pseudo</th>
                <th className="text-left px-4 py-3">Points</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row) => {
                const isCurrentUser = row.user_id === user?.id;
                return (
                  <tr
                    key={row.user_id}
                    className={`border-t transition ${isCurrentUser ? 'bg-orange-100 font-bold' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-2">{row.rank}</td>
                    <td className="px-4 py-2">{row.username}</td>
                    <td className="px-4 py-2">{row.total_points}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && leaderboard.length === 0 && (
        <p className="text-center text-sm text-gray-500 my-4">Aucun participant pour cette vue.</p>
      )}
    </div>
  )
}
