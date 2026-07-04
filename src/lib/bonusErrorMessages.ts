export const bonusErrorMessages: Record<string, string> = {
    FORBIDDEN_USER: "Utilisateur non autorisé.",
    ARGS_MISSING: "Information manquante.",
    GRID_NOT_FOUND: "Grille introuvable.",
    MATCH_NOT_IN_GRID: "Ce match n'appartient pas à cette grille.",
    MATCH_NOT_FOUND: "Match introuvable.",
    LOCKED_ALREADY_STARTED: "Ce bonus ne peut plus être modifié.",
    CAP_REACHED: "Tu as déjà utilisé ce bonus au maximum.",
    INSUFFICIENT_STOCK: "Tu n'as plus ce bonus en stock.",
    BIELSA_ONLY_WITH_BUTS: "BIELSA ne peut être combiné qu'avec le bonus BUTS.",
    BIELSA_BLOCKS_OTHERS: "Avec BIELSA, seul le bonus BUTS est autorisé.",
    MATCH_ALREADY_HAS_BONUS: "Un bonus est déjà posé sur ce match.",
    MATCH_WIN_ALREADY_HAS_BONUS: "Bonus RIBERY déjà mis sur ce match.",
    MATCH_ZERO_ALREADY_HAS_BONUS: "Bonus RIBERY déjà mis sur ce match.",
};

export function formatBonusErrorReasons(reasons: string[]) {
  return (
    reasons
      .map(r => {
        const key = String(r).trim().replace(/^"|"$/g, "");
        return bonusErrorMessages[key] ?? key;
      })
      .join("\n") || "Bonus refusé."
  );
}