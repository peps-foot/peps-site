// lib/competitionsGrouping.ts

/**
 * Flags nécessaires pour classer les compétitions
 *
 * - isMember  : le joueur est dans competition_members pour cette compét
 * - canPlay   : null/undefined = pas de restriction,
 *               false = le joueur est bloqué (grid_player_eligibility.can_play = false)
 * - hasNonFT  : il existe au moins un match de la compét avec un statut != 'FT'
 * - hasNS     : il existe au moins un match de la compét avec statut 'NS'
 * - allFT     : tous les matchs de la compét sont 'FT'
 *
 * Le type est générique : on garde toutes les autres propriétés de ta Competition.
 */

export type CompetitionWithFlags<T = unknown> = T & {
  isMember: boolean;
  canPlay?: boolean | null;
  hasNonFT: boolean;
  hasNS: boolean;
  allFT: boolean;
  homeTab?: "MINE" | "TO_JOIN" | "HISTORY" | "HIDDEN" | string;
};

export type CompetitionGroups<T = unknown> = {
  mine: CompetitionWithFlags<T>[];
  toJoin: CompetitionWithFlags<T>[];
  history: CompetitionWithFlags<T>[];
};

export function splitCompetitions<T = unknown>(
  comps: CompetitionWithFlags<T>[],
): CompetitionGroups<T> {
  const mine: CompetitionWithFlags<T>[] = [];
  const toJoin: CompetitionWithFlags<T>[] = [];
  const history: CompetitionWithFlags<T>[] = [];

  for (const c of comps) {
    const isBlocked = c.canPlay === false;

    // 1) HISTORIQUE : tous les matchs FT
    if (c.allFT) {
      history.push(c);
      continue;
    }

    // 2) MES COMPÉT' : je suis membre, mais la compétition n'est pas finie
    if (c.isMember) {
      mine.push(c);
      continue;
    }

    // 3) À REJOINDRE : je ne suis pas membre, je ne suis pas bloqué,
    //    il reste au moins un match NS, et la compétition n'est pas finie.
    if (!isBlocked && c.hasNS) {
      toJoin.push(c);
      continue;
    }

    // 4) Sinon : la compét n'apparaît nulle part
    // (par ex. publique déjà commencée, plus de NS, pas encore totalement FT,
    //  et user jamais inscrit → pas très intéressante à montrer)
  }

  return { mine, toJoin, history };
}


