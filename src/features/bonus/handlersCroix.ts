// Pour valider ou modifier les bonus CROIX
import supabase from "../../lib/supabaseBrowser";

export type BonusParameters = Record<string, any>;

export type HandleBonusValidateCroixCtx = {
  user: { id: string } | null;
  grid: { id: string };
  matches: Array<{ id: string; date: string }>;
  gridBonuses: Array<{
    bonus_definition: string;
    match_id: string;
    parameters: any;
  }>;
  openedBonus: { id: string; code: "KANTE" | "RIBERY" | "ZLATAN" | "BIELSA" } | null;
  popupMatch1: string;
  popupMatch0: string;
  popupPair: "1-N" | "N-2" | "1-2" | "";
  popupPick: "1" | "N" | "2" | "";
  setShowOffside: (v: boolean) => void;
  setOpenedBonus: (v: null) => void;
  setPopupMatch1: (v: string) => void;
  setPopupMatch0: (v: string) => void;
  setGridBonuses: React.Dispatch<React.SetStateAction<any[]>>;
};

export async function handleBonusValidateCroix(ctx: HandleBonusValidateCroixCtx) {
  const {
    user, grid, matches, gridBonuses, openedBonus,
    popupMatch1, popupMatch0, popupPair, popupPick,
    setShowOffside, setOpenedBonus, setPopupMatch1, setPopupMatch0, setGridBonuses,
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
      parameters: { picks: [] },
    };

    // Si un bonus existe déjà : interdiction de modif si un des matchs a démarré (60s de marge)
    const bonusExistant = gridBonuses.find(b => b.bonus_definition === openedBonus.id);
    if (bonusExistant) {
      const margin = 60 * 1000;
      let matchIdsToCheck: string[] = [];

      if (
        openedBonus.code === "RIBERY" &&
        "match_win" in bonusExistant.parameters &&
        "match_zero" in bonusExistant.parameters
      ) {
        matchIdsToCheck = [
          bonusExistant.parameters.match_win,
          bonusExistant.parameters.match_zero,
        ];
      } else {
        matchIdsToCheck = [bonusExistant.match_id];
      }

      for (const matchId of matchIdsToCheck) {
        const m = matches.find(m => m.id === matchId);
        if (!m || !("date" in m)) continue;

        const matchTime = new Date(m.date).getTime();
        const now = Date.now();
        if (now > matchTime - margin) {
          setShowOffside(true);
          return;
        }
      }
    }

    // Vérifs de sélection côté UI
    const matchesToCheck =
      openedBonus.code === "RIBERY" ? [popupMatch1, popupMatch0] :
      openedBonus.code === "ZLATAN" ? [popupMatch1] :
      openedBonus.code === "KANTE"  ? [popupMatch1] :
      openedBonus.code === "BIELSA" ? [popupMatch1] : [];

    if (matchesToCheck.length === 0 || matchesToCheck.includes("")) return;

    for (const matchId of matchesToCheck) {
      const m = matches.find(m => m.id === matchId);
      if (!m || !("date" in m)) return;
      const margin = 60 * 1000;
      if (Date.now() > new Date(m.date).getTime() - margin) {
        setShowOffside(true);
        return;
      }
    }

    // Paramètres selon le bonus
    switch (openedBonus.code) {
      case "KANTE":
        if (!popupMatch1) return alert("Match requis pour Kanté");
        payload.parameters = {
          picks:
            popupPair === "1-N" ? ["1", "N"]
          : popupPair === "N-2" ? ["N", "2"]
          : ["1", "2"],
        };
        break;

      case "RIBERY":
        if (!popupMatch1 || !popupMatch0) return alert("Sélectionnez 2 matchs différents pour Ribéry");
        if (popupMatch1 === popupMatch0) return alert("Les 2 matchs doivent être différents");
        payload.match_id = popupMatch1 ?? "";
        payload.parameters = { match_win: popupMatch1, match_zero: popupMatch0 };
        break;

      case "ZLATAN":
        if (!popupMatch1) return alert("Match requis pour Zlatan");
        payload.parameters = { pick: popupPick };
        break;

      case "BIELSA":
        if (!popupMatch1) return alert("Match requis pour Bielsa");
        payload.match_id = popupMatch1;
        payload.parameters = { pick: popupPick };
        break;

      default:
        return alert("Bonus non reconnu : " + openedBonus.code);
    }

    // 1) Dry-run RPC
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

    // 2) Commit RPC
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

    // 3) Rechargement des bonus de la grille
    const { data: gbs, error: gbe } = await supabase
      .from("grid_bonus")
      .select("id, grid_id, user_id, bonus_definition, match_id, parameters")
      .eq("grid_id", grid.id);

    if (gbe) {
      alert("Erreur de rechargement des bonus");
      return;
    }
    setGridBonuses(gbs || []);

    // 4) Fermeture UI
    setOpenedBonus(null);
    setPopupMatch1("");
    setPopupMatch0("");
  } catch (e: any) {
    alert("Erreur : " + (e?.message ?? String(e)));
  }
}
