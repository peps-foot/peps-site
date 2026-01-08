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

  const leagueIds = [6,61,66]; //2,3,61,848
  // 2=LDC, 3=Europa, 6=CAN, 61=L1, 66=CDF, 848=Conférence
  const allFixtures: any[] = [];

  for (const leagueId of leagueIds) {
    //    const url = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${SEASON}&status=NS`;
    const url = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${SEASON}`;
    logs.push(`🔵 Appel API fixtures : ${url}`);

    const res = await fetch(url, {
      headers: { 'x-apisports-key': API_KEY }
    });

    const json = await res.json();

    if (json.response && Array.isArray(json.response)) {
      const statusCount: Record<string, number> = {};
      for (const f of json.response) {
        const s = f?.fixture?.status?.short || 'UNK';
        statusCount[s] = (statusCount[s] || 0) + 1;
      }
      logs.push(`📊 Statuts league ${leagueId} : ${JSON.stringify(statusCount)}`);
      logs.push(`🟢 ${json.response.length} matchs récupérés pour league ${leagueId}`);
      allFixtures.push(...json.response);
    }

    await new Promise((r) => setTimeout(r, 250));
  }

  logs.push(`🟢 ${allFixtures.length} matchs au total récupérés`);

  // 🔍 On récupère les équipes déjà présentes dans la table teams
  const { data: teamIdsInDb, error: fetchTeamsErr } = await supabase
    .from('teams')
    .select('id');

  if (fetchTeamsErr || !teamIdsInDb) {
    logs.push('❌ Erreur récupération des teams en BDD avant insertion matchs');
    return NextResponse.json({ ok: false, logs });
  }

  const validTeamIds = new Set(teamIdsInDb.map(t => t.id));

  // --- DIAGNOSTIC ---
let exclNonNS = 0;
let exclPasse = 0;
let exclTeams = 0;

for (const m of allFixtures) {
  const isNS = m?.fixture?.status?.short === 'NS';
  const kickoff = new Date(m?.fixture?.date);
  const isFuture = kickoff.getTime() > Date.now();
  const teamsOK =
    validTeamIds.has(m?.teams?.home?.id) &&
    validTeamIds.has(m?.teams?.away?.id);

  if (!isNS) { exclNonNS++; continue; }
  if (!isFuture) { exclPasse++; continue; }
  if (!teamsOK) { exclTeams++; continue; }
}

logs.push(`ℹ️ Exclues: non-NS=${exclNonNS}, passées=${exclPasse}, teams_manquantes=${exclTeams}`);
// --- FIN DIAGNOSTIC ---

  const ALLOWED = new Set(['NS','TBD','TBA']);

  // 🎯 On filtre les matchs à insérer
  const matchesToInsert = allFixtures
    .filter((m: any) =>
      ALLOWED.has(m.fixture.status.short) &&
      new Date(m.fixture.date) > new Date() &&
      validTeamIds.has(m.teams.home.id) &&
      validTeamIds.has(m.teams.away.id)
    )
    .map((item: any) => ({
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
      is_locked: false
    }));


  logs.push(`🧹 ${matchesToInsert.length} matchs à insérer (NS et à venir)`);

  const { error: insertError } = await supabase
    .from('matches')
    .upsert(matchesToInsert, { onConflict: 'fixture_id' });

  if (insertError) {
    logs.push(`❌ Erreur insertion matches : ${insertError.message}`);
    return NextResponse.json({ ok: false, logs });
  }

  logs.push('✅ Insertion / mise à jour des matchs terminée');

  // 🧮 Insertion des cotes (si disponibles) — VERSION 5 MOYENNES SUR 10 BOOKMAKERS
  let oddsInserted = 0;
  let oddsSkipped = 0;

  // ordre de priorité des 10 bookmakers (API-FOOTBALL ids)
  const PRIORITY_BOOKMAKERS = [8, 6, 16, 24, 21, 22, 15, 26, 32, 30];
  const BOOKMAKERS_PARAM = PRIORITY_BOOKMAKERS.join(','); // "8,6,16,24,21,22,15,26,32,30"

  // helper: extraire une cote par libellé possible
  const pickOdd = (values: any[], labels: string[]) => {
    const v = values.find(x => labels.includes(String(x.value)));
    return v ? parseFloat(v.odd) : null;
  };

  // helper: score de priorité (plus petit = plus prioritaire)
  const priorityRank = (id: number) => {
    const idx = PRIORITY_BOOKMAKERS.indexOf(id);
    return idx === -1 ? 999 : idx;
  };

  for (const match of matchesToInsert) {
    const fixtureId = match.fixture_id;
    logs.push(`🔍 Traitement des cotes (5/10) pour fixture ${fixtureId}`);

    try {
      // déjà en base ?
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

      // On limite aux marchés 1X2/Match Winner et aux 10 bookmakers priorisés
      const oddsUrl =
        `https://v3.football.api-sports.io/odds?fixture=${fixtureId}&bet=1`;
      logs.push(`🔵 Appel API odds : ${oddsUrl}`);

      const oddsRes = await fetch(oddsUrl, {
        headers: { 'x-apisports-key': API_KEY }
      });
      const oddsJson = await oddsRes.json();
        if (oddsJson?.errors && Object.keys(oddsJson.errors).length) {
          logs.push(`⚠️ API errors odds fixture ${fixtureId} : ${JSON.stringify(oddsJson.errors)}`);
        }

      const resp = Array.isArray(oddsJson.response) ? oddsJson.response : [];
      if (resp.length === 0) {
        logs.push(`⚠️ Pas de cotes pour match ${fixtureId}`);
        continue;
      }

      const bookmakers = resp.flatMap((r: any) => Array.isArray(r.bookmakers) ? r.bookmakers : []);
      if (!Array.isArray(bookmakers) || bookmakers.length === 0) {
        logs.push(`⚠️ Pas de bookmaker pour match ${fixtureId}`);
        continue;
      }

      // On collecte les triplets 1/N/2 complets par bookmaker
      type Triplet = { id: number; name: string; o1: number; oN: number; o2: number; rank: number };
      const triplets: Triplet[] = [];

      for (const bm of bookmakers) {
        const bmId = Number(bm.id);
        const bmName = bm.name ?? `book_${bmId}`;
        const bets = Array.isArray(bm.bets) ? bm.bets : [];

        // Cherche le pari 1X2 / Match Winner
        const bet = bets.find(
          (b: any) =>
            b?.name === 'Match Winner' ||
            b?.name === '1X2' ||
            b?.id === 1 ||               // souvent id=1 = Match Winner
            String(b?.key).toLowerCase() === '1x2'
        );
        if (!bet || !Array.isArray(bet.values)) continue;

        const values = bet.values;

        // Robustesse : certains renvoient "Home/Draw/Away", d'autres "1/X/2"
        const o1 = pickOdd(values, ['Home', '1']);
        const oN = pickOdd(values, ['Draw', 'X']);
        const o2 = pickOdd(values, ['Away', '2']);

        if (o1 != null && oN != null && o2 != null) {
          triplets.push({
            id: bmId,
            name: bmName,
            o1,
            oN,
            o2,
            rank: priorityRank(bmId),
          });
        }
      }

      if (triplets.length === 0) {
        logs.push(`⚠️ Aucun triplet complet 1/N/2 pour match ${fixtureId}`);
        continue;
      }

      // On garde 1 triplet par bookmaker selon la priorité, puis on en prend 5
      const uniqueByBm = new Map<number, Triplet>();
      // trie par rank croissant (priorité) puis par nom (stable)
      triplets.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
      for (const t of triplets) {
        if (!uniqueByBm.has(t.id)) uniqueByBm.set(t.id, t);
        if (uniqueByBm.size >= 5) break;
      }

      const picked = Array.from(uniqueByBm.values());
      const MIN_REQUIRED = 3;
      if (picked.length < MIN_REQUIRED) {
        logs.push(`⚠️ Seulement ${picked.length}/${MIN_REQUIRED} triplets pour match ${fixtureId} → on n’insère pas.`);
        continue;
      }

      // Moyennes (brutes) 1 / N / 2
      const avg = picked.reduce(
        (acc, t) => {
          acc.o1 += t.o1; acc.oN += t.oN; acc.o2 += t.o2; return acc;
        },
        { o1: 0, oN: 0, o2: 0 }
      );
      const m1 = avg.o1 / picked.length;
      const mN = avg.oN / picked.length;
      const m2 = avg.o2 / picked.length;

      // insertion unique dans `odds`
      const { error: insertErr } = await supabase.from('odds').insert({
        match_id: fixtureId,
        odd_1: m1,
        odd_X: mN,
        odd_2: m2,
        provider: 'AVG_5' // on indique que ce sont des moyennes sur 5
        // si tu ajoutes une colonne JSON "providers_used", tu peux stocker les ids utilisés :
        // providers_used: picked.map(p => p.id)
      });
      logs.push(`ℹ️ Triplets trouvés pour ${fixtureId} : ${triplets.length}`);

      if (insertErr) {
        logs.push(`❌ Erreur insertion odds (AVG_5) pour match ${fixtureId} : ${insertErr.message}`);
      } else {
        oddsInserted++;
        logs.push(
          `✅ Cotes (moyenne sur 5) insérées pour match ${fixtureId} — ` +
          `bm utilisés=${picked.map(p => `${p.name}#${p.id}`).join(', ')}`
        );
      }

      await new Promise((r) => setTimeout(r, 300));
    } catch (e: any) {
      logs.push(`❌ Exception lors du traitement odds match ${fixtureId} : ${e.message}`);
    }
  }


  logs.push(`🟢 Terminé : ${oddsInserted} cotes insérées, ${oddsSkipped} ignorées`);
  
  return NextResponse.json({
    ok: true,
    inserted_matches: matchesToInsert.length,
    inserted_odds: oddsInserted,
    skipped_odds: oddsSkipped,
    logs
  });
}