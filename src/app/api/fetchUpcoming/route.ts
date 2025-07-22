import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';
const API_KEY = '112a112da460820962f5e9fc0b261d2a';
const SEASON = 2025;

export async function GET() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const logs: string[] = [];

  logs.push('🟠 Lancement de fetchUpcoming');

  const leagueIds = [2, 3];
  const allFixtures: any[] = [];

  for (const leagueId of leagueIds) {
    const url = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${SEASON}&status=NS`;
    logs.push(`🔵 Appel API fixtures : ${url}`);

    const res = await fetch(url, {
      headers: { 'x-apisports-key': API_KEY }
    });

    const json = await res.json();

    if (json.response && Array.isArray(json.response)) {
      logs.push(`🟢 ${json.response.length} matchs récupérés pour league ${leagueId}`);
      allFixtures.push(...json.response);
    } else {
      logs.push(`⚠️ Aucun match pour league ${leagueId}`);
    }

    await new Promise((r) => setTimeout(r, 250)); // pour éviter de spammer l’API
  }

  const fixtures = allFixtures;
  logs.push(`🟢 ${fixtures.length} matchs au total récupérés`);

  // 🧠 Étape : insérer les équipes manquantes dans la table "teams"
  const allTeamsMap = new Map<number, { id: number, name: string, short_name: string }>();

  for (const match of fixtures) {
    const home = match.teams.home;
    const away = match.teams.away;

    if (home?.id) {
      allTeamsMap.set(home.id, {
        id: home.id,
        name: home.name,
        short_name: home.name.slice(0, 15) // ou toute autre logique
      });
    }

    if (away?.id) {
      allTeamsMap.set(away.id, {
        id: away.id,
        name: away.name,
        short_name: away.name.slice(0, 15)
      });
    }
  }

  const allTeams = Array.from(allTeamsMap.values());

  const { data: existingTeams, error: teamSelectError } = await supabase
    .from('teams')
    .select('id');

  if (teamSelectError) {
    logs.push(`❌ Erreur récupération équipes existantes : ${teamSelectError.message}`);
    return NextResponse.json({ ok: false, logs });
  }

  const existingIds = new Set(existingTeams?.map(t => t.id));
  const newTeams = allTeams.filter(t => !existingIds.has(t.id));

  if (newTeams.length > 0) {
    const { error: teamInsertError } = await supabase
      .from('teams')
      .insert(newTeams);

    if (teamInsertError) {
      logs.push(`❌ Erreur insertion équipes : ${teamInsertError.message}`);
      return NextResponse.json({ ok: false, logs });
    }

    logs.push(`✅ ${newTeams.length} nouvelles équipes insérées`);
  } else {
    logs.push(`ℹ️ Aucune nouvelle équipe à insérer`);
  }

  // 🏟 Insertion ou mise à jour des matchs
  const matchData = fixtures.map((item: any) => ({
    fixture_id: item.fixture.id,
    date: item.fixture.date,
    league_id: item.league.id,
    league_name: item.league.name,
    home_team: item.teams.home.name,
    away_team: item.teams.away.name,
    team_home_id: item.teams.home.id,
    team_away_id: item.teams.away.id,
    status: item.fixture.status.short,
    score_home: item.goals.home,
    score_away: item.goals.away,
    is_locked: false,
  }));

  const { error: insertError } = await supabase
    .from('matches')
    .upsert(matchData, { onConflict: 'fixture_id', ignoreDuplicates: true });

  if (insertError) {
    logs.push(`❌ Erreur insertion matches : ${insertError.message}`);
    return NextResponse.json({ ok: false, logs });
  }

  logs.push(`✅ Insertion / mise à jour des matchs terminée`);

  // 🎯 Récupération et insertion des cotes
  let oddsInserted = 0;
  let oddsSkipped = 0;

  for (const match of fixtures) {
    const fixtureId = match.fixture.id;

    logs.push(`🔍 Traitement des cotes pour fixture ${fixtureId}`);

    try {
      const { data: existingOdds, error: selectError } = await supabase
        .from('odds')
        .select('id')
        .eq('match_id', fixtureId)
        .maybeSingle();

      if (selectError) {
        logs.push(`❌ Erreur SELECT odds pour fixture ${fixtureId} : ${selectError.message}`);
        continue;
      }

      if (existingOdds) {
        oddsSkipped++;
        logs.push(`⏩ Cotes déjà existantes pour match ${fixtureId}, on saute.`);
        continue;
      }

      logs.push(`📡 Appel API odds pour fixture ${fixtureId}`);
      const oddsRes = await fetch(`https://v3.football.api-sports.io/odds?fixture=${fixtureId}`, {
        headers: { 'x-apisports-key': API_KEY }
      });

      const oddsJson = await oddsRes.json();
      const bookmakers = oddsJson.response?.[0]?.bookmakers || [];

      if (bookmakers.length === 0) {
        logs.push(`⚠️ Pas de bookmaker pour match ${fixtureId}`);
        continue;
      }

      const matchWinner = bookmakers[0].bets?.find((b: any) => b.name === 'Match Winner');

      if (!matchWinner) {
        logs.push(`⚠️ Pas de pari Match Winner pour match ${fixtureId}`);
        continue;
      }

      let odd_1 = null, odd_X = null, odd_2 = null;
      for (const v of matchWinner.values) {
        if (v.value === 'Home') odd_1 = parseFloat(v.odd);
        if (v.value === 'Draw') odd_X = parseFloat(v.odd);
        if (v.value === 'Away') odd_2 = parseFloat(v.odd);
      }

      if (odd_1 && odd_X && odd_2) {
        const { error: insertErr } = await supabase.from('odds').insert({
          match_id: fixtureId,
          odd_1,
          odd_X,
          odd_2,
          provider: bookmakers[0]?.name || 'unknown'
        });

        if (insertErr) {
          logs.push(`❌ Erreur insertion odds pour match ${fixtureId} : ${insertErr.message}`);
        } else {
          oddsInserted++;
          logs.push(`✅ Cotes insérées pour match ${fixtureId}`);
        }
      } else {
        logs.push(`❌ Cotes incomplètes pour match ${fixtureId}`);
      }

      await new Promise((r) => setTimeout(r, 300));

    } catch (e: any) {
      logs.push(`❌ Exception lors du traitement odds match ${fixtureId} : ${e.message}`);
    }
  }

  logs.push(`🟢 Terminé : ${oddsInserted} cotes insérées, ${oddsSkipped} ignorées`);

  return NextResponse.json({
    ok: true,
    inserted_matches: fixtures.length,
    inserted_odds: oddsInserted,
    skipped_odds: oddsSkipped,
    logs
  });
}
