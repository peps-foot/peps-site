import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient('https://rvswrzxdzfdtenxqtbci.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ'
);

export async function GET() {
  const now = new Date().toISOString();

  // 1. Sélectionne les matchs à mettre à jour
  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, fixture_id")
    .or(`and(date.lt.${now},status.eq.NS),status.eq.1H,status.eq.HT,status.eq.2H,status.eq.SUSP,status.eq.INT`)

  if (error) {
    console.error("❌ Erreur Supabase :", error);
    return NextResponse.json({ status: "error", message: "Erreur Supabase" });
  }

  if (!matches || matches.length === 0) {
    console.log("✅ Aucun match à mettre à jour");
    return NextResponse.json({ status: "ok", message: "Aucun match à suivre" });
  }

  // 2. Regroupe les fixture_id par lots de 20 max
  const fixtureIds = matches.map((m) => m.fixture_id);
  const batches = [];
  for (let i = 0; i < fixtureIds.length; i += 20) {
    batches.push(fixtureIds.slice(i, i + 20));
  }

  const allFixtures: any[] = [];

  // 3. Récupère les infos de l'API pour chaque batch
  for (const batch of batches) {
    const url = `https://v3.football.api-sports.io/fixtures?ids=${batch.join("-")}`;
    const res = await fetch(url, {
      headers: {
        "x-apisports-key": '112a112da460820962f5e9fc0b261d2a',
      },
    });

    const json = await res.json();
    if (json.response && Array.isArray(json.response)) {
      allFixtures.push(...json.response);
    }
  }

  if (allFixtures.length === 0) {
    console.log("⚠️ Aucune donnée reçue de l’API");
    return NextResponse.json({ status: "ok", message: "Pas de mise à jour" });
  }

  // 4. Prépare les données à upsert
  const updates = allFixtures.map((match: any) => ({
    fixture_id: match.fixture.id,
    status: match.fixture.status.short,
    score_home: match.goals.home,
    score_away: match.goals.away,
  }));

  const { error: upsertError } = await supabase
    .from("matches")
    .upsert(updates, { onConflict: "fixture_id" });

  if (upsertError) {
    console.error("❌ Erreur upsert :", upsertError);
    return NextResponse.json({ status: "error", message: "Erreur mise à jour Supabase" });
  }

  console.log("✅ Mises à jour effectuées :", updates.length);
  return NextResponse.json({ status: "ok", updated: updates.length });
}