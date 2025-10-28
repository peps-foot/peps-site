// Pour valider ou modifier les bonus SPECIAUX
import supabase from "../../lib/supabaseBrowser";

export type BonusParameters = Record<string, any>;

export type HandleBonusValidateSpeciauxCtx = {
  user: { id: string } | null;
  grid: { id: string };
  matches: Array<{ id: string; date: string }>;
  gridBonuses: Array<{
    bonus_definition: string;
    match_id: string;
    parameters: any;
  }>;
  // BONUS SPECIAUX : BOOST_1 / BOOST_2 / BOOST_3
  openedBonus: { id: string; code: "BOOST_1" | "BOOST_2" | "BOOST_3" } | null;

  // états UI
  popupMatch1: string;               // match sélectionné
  popupPick: "1" | "N" | "2" | "";   // équipe (N autorisé ici)

  // setters
  setShowOffside: (v: boolean) => void;
  setOpenedBonus: (v: null) => void;
  setPopupMatch1: (v: string) => void;
  setGridBonuses: React.Dispatch<React.SetStateAction<any[]>>;
};

export async function handleBonusValidateSpeciaux(ctx: HandleBonusValidateSpeciauxCtx) {
  const {
    user, grid, matches, gridBonuses, openedBonus,
    popupMatch1, popupPick,
    setShowOffside, setOpenedBonus, setPopupMatch1, setGridBonuses,
  } = ctx;

  if (!openedBonus || !user) return;

  try {
    // Payload de base
    const payload: {
      user_id: string;
      grid_id: string;
      bonus_definition: string;
      match_id: string;
      parameters: BonusParameters;
    } = {
      user_id: user.id,
      grid_id: grid.id,
      bonus_definition: openedBonus.id,
      match_id: popupMatch1,
      parameters: {}, // sera { pick: '1' | 'N' | '2' }
    };

    // 1) Sélections minimales côté UI
    if (!popupMatch1) {
      alert("Sélectionne un match.");
      return;
    }
    if (!popupPick) {
      alert("Sélectionne un pick (1, N ou 2).");
      return;
    }

    // 2) Interdiction de MODIFIER si le match du bonus existant a démarré (marge 60s)
    const existing = gridBonuses.find(b => b.bonus_definition === openedBonus.id);
    if (existing) {
      const margin = 60 * 1000;
      const m = matches.find(m => m.id === existing.match_id);
      if (m && "date" in m) {
        const matchTime = new Date(m.date).getTime();
        if (Date.now() > matchTime - margin) {
          setShowOffside(true);
          return;
        }
      }
    }

    // 3) Paramètres SPECIAUX (BOOST_X) — même schéma que Zlatan
    payload.parameters = { pick: popupPick }; // '1' | 'N' | '2'

    // 4) Dry-run RPC
    const dryRun = await supabase.rpc("play_bonus", {
      p_user_id: payload.user_id,
      p_grid_id: payload.grid_id,
      p_bonus_definition: payload.bonus_definition,
      p_match_id: payload.match_id,
      p_parameters: payload.parameters,
      p_dry_run: true,
    });

    if (dryRun.error) {
      alert("Erreur RPC (dry-run) : " + (dryRun.error.message || "inconnue"));
      return;
    }
    const dry = dryRun.data?.[0];
    const reasons: string[] = Array.isArray(dry?.reasons) ? dry.reasons : [];
    if (!dry?.ok) {
      alert("Bonus refusé: " + (reasons.join(", ") || "inconnu"));
      return;
    }

    // 5) Commit RPC
    const commitRes = await supabase.rpc("play_bonus", {
      p_user_id: payload.user_id,
      p_grid_id: payload.grid_id,
      p_bonus_definition: payload.bonus_definition,
      p_match_id: payload.match_id,
      p_parameters: payload.parameters,
      p_dry_run: false,
    });
    if (commitRes.error) {
      alert("Erreur RPC (commit) : " + (commitRes.error.message || "inconnue"));
      return;
    }

    // 6) Rechargement des bonus de la grille
    const { data: gbs, error: gbe } = await supabase
      .from("grid_bonus")
      .select("id, grid_id, user_id, bonus_definition, match_id, parameters")
      .eq("grid_id", grid.id);

    if (gbe) {
      alert("Erreur de rechargement des bonus");
      return;
    }
    setGridBonuses(gbs || []);

    // 7) Reset UI
    setOpenedBonus(null);
    setPopupMatch1("");
  } catch (e: any) {
    alert("Erreur : " + (e?.message ?? String(e)));
  }
}
