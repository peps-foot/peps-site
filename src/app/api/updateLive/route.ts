// app/api/updateLive/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const SUPABASE_URL = process.env.SUPABASE_URL || ''
  if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL is missing (updateLive)')
  }
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  try {
    // 🔍 On récupère tous les matches non terminés et déjà verrouillés
    const { data: liveMatches, error } = await supabase
      .from('matches')
      .select('fixture_id')
      .neq('status', 'FT')
      .eq('is_locked', true)

    if (error || !liveMatches || liveMatches.length === 0) {
      return NextResponse.json({ message: 'Aucun match à mettre à jour' })
    }

    const fixtureIds = liveMatches.map((m) => m.fixture_id)
    const groups = groupIntoChunks(fixtureIds, 20) // 20 max par appel API
    const API_KEY = process.env.API_FOOTBALL_KEY!;
    
    for (const batch of groups) {
      const idList = batch.join(',')
      const res = await fetch(`https://v3.football.api-sports.io/fixtures?ids=${idList}`, {
        headers: {
          'x-apisports-key': API_KEY
        }
      })
      const json = await res.json()
      const fixtures = json.response

      for (const fixture of fixtures) {
        const fid = fixture.fixture.id
        const status = fixture.fixture.status.short
        const scoreHome = fixture.goals.home
        const scoreAway = fixture.goals.away

        await supabase
          .from('matches')
          .update({
            status,
            score_home: scoreHome,
            score_away: scoreAway,
            is_locked: ['FT', 'AET', 'PEN'].includes(status)
          })
          .eq('fixture_id', fid)
      }
    }

    return NextResponse.json({ ok: true, message: 'Scores mis à jour' })
  } catch (e) {
    console.error('Erreur updateLive', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// 🔁 Regroupe un tableau en sous-tableaux de 20 max
function groupIntoChunks<T>(arr: T[], chunkSize: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += chunkSize) {
    result.push(arr.slice(i, i + chunkSize))
  }
  return result
}
