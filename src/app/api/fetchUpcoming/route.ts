import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const SUPABASE_URL = process.env.SUPABASE_URL!
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const API_KEY = '112a112da460820962f5e9fc0b261d2a'
  const today = '2025-06-12'

  try {
    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${today}`,
      {
        headers: {
          'x-apisports-key': API_KEY
        }
      }
    )

    const json = await res.json()
    const fixtures = json.response

    if (!fixtures || fixtures.length === 0) {
      return NextResponse.json({ ok: true, message: 'Aucun match trouvé' })
    }

    const headers = { 'x-apisports-key': API_KEY }
    const matchRows = []

    for (const match of fixtures) {
      matchRows.push({
        fixture_id: match.fixture.id,
        league_name: match.league.name,
        date: match.fixture.date,
        home_team: match.teams.home.name,
        away_team: match.teams.away.name,
        score_home: match.goals.home,
        score_away: match.goals.away,
        status: match.fixture.status.short,
        is_locked: false,
        odd_1_snapshot: null,
        odd_n_snapshot: null,
        odd_2_snapshot: null,
        base_1_points: null,
        base_n_points: null,
        base_2_points: null
      })
    }

    const { error: matchInsertError } = await supabase
      .from('matches')
      .upsert(matchRows, { onConflict: ['fixture_id'] })

    if (matchInsertError) {
      console.error('Erreur Supabase (matches) :', matchInsertError)
      return NextResponse.json({ ok: false, error: matchInsertError.message })
    }

    let oddsInserted = 0

    for (const match of fixtures) {
      try {
        const oddsRes = await fetch(
          `https://v3.football.api-sports.io/odds?fixture=${match.fixture.id}`,
          { headers }
        )
        const oddsJson = await oddsRes.json()
        const bookmakers = oddsJson.response?.[0]?.bookmakers || []
        const matchWinner = bookmakers?.[0]?.bets?.find(b => b.name === 'Match Winner')

        if (matchWinner) {
          let odd_1 = null, odd_X = null, odd_2 = null
          for (const v of matchWinner.values) {
            if (v.value === 'Home') odd_1 = parseFloat(v.odd)
            if (v.value === 'Draw') odd_X = parseFloat(v.odd)
            if (v.value === 'Away') odd_2 = parseFloat(v.odd)
          }
          if (odd_1 && odd_X && odd_2) {
            const oddsInsert = {
              match_id: match.fixture.id,
              odd_1,
              odd_X,
              odd_2,
              provider: bookmakers[0]?.name || 'unknown'
            }
            const { error: insertErr } = await supabase.from('odds').insert([oddsInsert])
            if (!insertErr) oddsInserted++
          }
        }
      } catch (oddsErr) {
        console.warn('Erreur odds pour match', match.fixture.id)
      }
    }

    return NextResponse.json({
      ok: true,
      inserted_matches: matchRows.length,
      inserted_odds: oddsInserted
    })
  } catch (err: any) {
    console.error('Erreur API :', err)
    return NextResponse.json({ ok: false, error: err.message })
  }
}
