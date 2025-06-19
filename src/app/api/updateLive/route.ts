// app/api/updateLive/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';
const API_KEY = '112a112da460820962f5e9fc0b261d2a';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function GET() {
  const now = new Date().toISOString();

  // 1. Récupère les matchs "en retard" ou "en cours"
  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, fixture_id")
    .in("status", ["NS", "1H", "HT", "2H"])

  if (error) {
    console.error("Erreur Supabase matches:", error);
    return NextResponse.json({ status: "error", message: "Erreur Supabase" });
  }

  if (!matches || matches.length === 0) {
    return NextResponse.json({ status: "ok", message: "Aucun match à mettre à jour" });
  }

  const fixtureIds = matches.map((m) => m.fixture_id).join("-");

  // 2. Appel API-Football pour ces matchs
  const apiResponse = await fetch(`https://v3.football.api-sports.io/fixtures?ids=${fixtureIds}`, {
    headers: {
      "x-apisports-key": API_KEY,
    },
  });

  const apiData = await apiResponse.json();

  if (!apiData.response || apiData.response.length === 0) {
    return NextResponse.json({ status: "ok", message: "Aucune donnée API" });
  }

  // 3. Prépare et applique la mise à jour
  const updates = apiData.response.map((match: any) => {
    return {
      fixture_id: match.fixture.id,
      status: match.fixture.status.short,
      score_home: match.goals.home,
      score_away: match.goals.away,
    };
  });

    for (const update of updates) {
      const { error: updateError, count } = await supabase
        .from("matches")
        .update({
          status: update.status,
          score_home: update.score_home,
          score_away: update.score_away,
        })
        .eq("fixture_id", update.fixture_id)
        .select("*"); // pour avoir le count (ou utilise `.returns('minimal')` avec v2)

      if (updateError) {
        console.error(`❌ Erreur update match ${update.fixture_id} :`, updateError.message);
      } else if (count === 0) {
        console.warn(`⚠️ Aucun match mis à jour pour fixture_id ${update.fixture_id}`);
      } else {
        console.log(`✅ Match ${update.fixture_id} mis à jour avec ${update.score_home}-${update.score_away} (${update.status})`);
      }
    }

  return NextResponse.json({ status: "ok", message: `Mise à jour de ${updates.length} match(s)` });
}
