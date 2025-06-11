// app/api/fetchUpcoming/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Liste des compétitions à surveiller
const COMPETITIONS = [15, 10, 1186] // Coupe du monde, amicaux, qualifs

export async function GET() {
  const SUPABASE_URL = process.env.SUPABASE_URL || ''
  if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL is missing')
  }
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!
  const API_KEY = process.env.API_FOOTBALL_KEY!
  console.log('✅ SUPABASE_URL =', process.env.SUPABASE_URL)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  try {
    const season = new Date().getFullYear();

    for (const leagueId of COMPETITIONS) {
      const res = await fetch(`https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&next=10`, {
        headers: {
          'x-apisports-key': API_KEY
        }
      })

      const json = await res.json()
      console.log('📦 Données API-Football:', JSON.stringify(json.response, null, 2));
      if (!json.response) continue

      for (const fixture of json.response) {
        const f = fixture.fixture
        const t = fixture.teams
        const lid = fixture.league.id
        const fid = f.id

        // Vérifie si déjà présent
        const { data : existing } = await supabase
          .from('matches')
          .select('id')
          .eq('fixture_id', fid)
          .single()
        console.log('📦 Données brutes récupérées :', existing)

        if (existing) continue // Match déjà connu

        // Prépare insertion du match
        const newMatch = {
          fixture_id: fid,
          league_id: lid,
          date: f.date,
          home_team: t.home.name,
          away_team: t.away.name,
          status: f.status.short,
          is_locked: false,
        }

        const { error } = await supabase.from('matches').upsert([newMatch], { onConflict: 'fixture_id' })
        if (error) {
          console.error('❌ Erreur lors de l\'upsert :', error)
        } else {
          console.log('✅ Upsert réussi !')
        }

        // Appel aux cotes pour figer les odds
        const oddsRes = await fetch(`https://v3.football.api-sports.io/odds?fixture=${fid}`, {
          headers: {
            'x-apisports-key': API_KEY
          }
        })

        const oddsJson = await oddsRes.json()
        const bookmaker = oddsJson.response?.[0]?.bookmakers?.[0]
        const bets = bookmaker?.bets?.find((b: { name: string }) => b.name === "Match Winner")
        const values = bets?.values as { value: string; odd: string }[] | undefined;

        if (!values) continue

        const getOdd = (label: string) =>
          parseFloat(values?.find((v) => v.value === label)?.odd || '0');

        const odd1 = getOdd("Home Team")
        const oddX = getOdd("Draw")
        const odd2 = getOdd("Away Team")

        const pi = Math.PI
        const base_1 = Math.round(odd1 * pi)
        const base_n = Math.round(oddX * pi)
        const base_2 = Math.round(odd2 * pi)

        await supabase
          .from('matches')
          .update({
            odd_1_snapshot: odd1,
            odd_n_snapshot: oddX,
            odd_2_snapshot: odd2,
            base_1_points: base_1,
            base_n_points: base_n,
            base_2_points: base_2
          })
          .eq('fixture_id', fid)
      }
    }

    return NextResponse.json({ ok: true, message: 'Matches à venir mis à jour.' })

  } catch (e) {
    console.error('Erreur générale', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
