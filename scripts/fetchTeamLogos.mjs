import fs from "fs";
import path from "path";

//
// ⚠️ REMPLIS ICI (temporairement si tu veux vraiment "en dur").
// Idéalement: mets ça dans .env.local et utilise process.env.
//
const API_FOOTBALL_KEY = "112a112da460820962f5e9fc0b261d2a";
const SUPABASE_URL = "https://rvswrzxdzfdtenxqtbci.supabase.co"; // ex: https://xxxx.supabase.co
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ"; // ⚠️ service_role, local uniquement

// Dossier de sortie (dans ton projet)
const OUT_DIR = path.join(process.cwd(), "public", "images", "teams");
fs.mkdirSync(OUT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function supabaseSelectTeamIds() {
  // On lit tous les ids de la table teams via l'API REST Supabase
  const url = `${SUPABASE_URL}/rest/v1/teams?select=id&order=id.asc&limit=10000`;

  const r = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!r.ok) {
    throw new Error(`Supabase teams select failed: ${r.status} ${await r.text()}`);
  }

  return r.json(); // [{ id: 33 }, ...]
}

async function apiGetTeamLogoUrl(teamId) {
  const url = new URL("https://v3.football.api-sports.io/teams");
  url.searchParams.set("id", String(teamId));

  const r = await fetch(url.toString(), {
    headers: { "x-apisports-key": API_FOOTBALL_KEY },
    cache: "no-store",
  });

  const data = await r.json();

  // réponse typique: response[0].team.logo
  return data?.response?.[0]?.team?.logo ?? null;
}

async function downloadToFile(url, filePath) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download failed: ${r.status} ${url}`);

  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(filePath, buf);
}

async function main() {
  if (!API_FOOTBALL_KEY || API_FOOTBALL_KEY === "REMPLACE_MOI") {
    throw new Error("Tu dois renseigner API_FOOTBALL_KEY dans le script.");
  }
  if (!SUPABASE_URL || SUPABASE_URL === "REMPLACE_MOI") {
    throw new Error("Tu dois renseigner SUPABASE_URL dans le script.");
  }
  if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY === "REMPLACE_MOI") {
    throw new Error("Tu dois renseigner SUPABASE_SERVICE_ROLE_KEY dans le script.");
  }

  const rows = await supabaseSelectTeamIds();
  const teamIds = rows.map((x) => x.id);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const id of teamIds) {
    try {
      const outPath = path.join(OUT_DIR, `${id}.png`);

      // Si déjà téléchargé, on skip
      if (fs.existsSync(outPath)) {
        skipped++;
        continue;
      }

      const logoUrl = await apiGetTeamLogoUrl(id);
      if (!logoUrl) {
        console.log(`⚠️ Pas de logo trouvé pour team_id=${id}`);
        skipped++;
        continue;
      }

      await downloadToFile(logoUrl, outPath);
      ok++;

      console.log(`✅ ${id} -> /public/images/teams/${id}.png`);
      await sleep(200); // petite pause (évite de spammer l'API)
    } catch (e) {
      failed++;
      console.log(`❌ team_id=${id}:`, e?.message ?? e);
    }
  }

  console.log("Terminé :", { ok, skipped, failed });
  console.log("Logos dans :", OUT_DIR);
}

main().catch((e) => {
  console.error("Erreur :", e);
  process.exit(1);
});
