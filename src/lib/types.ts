// 🟠 Match récupéré depuis Supabase (via api-football)
export type Match = {
  id: string;
  home_team: string;
  away_team: string;
  date: string;
  score_home: number | null;
  score_away: number | null;
  status: string;
  base_1_points: number | null;
  base_n_points: number | null;
  base_2_points: number | null;
};

export type MatchWithOdds = Match & {
  grid_id: string;
  match_id: string;
  odd_1: number | null;
  odd_X: number | null;
  odd_2: number | null;
  pick: string;
  grids: {
    title: string;
    description: string;
    allowed_bonuses: string[];
  };
};

// 🟠 Paramètres personnalisés pour les différents types de bonus
export type BonusParameters =
  | { picks: string[] }                            // Bonus Kanté
  | { match_win: string; match_zero: string }     // Bonus Ribéry
  | { pick: string };                             // Bonus Zlatan

// 🟠 Bonus joué par un joueur sur une grille
export type GridBonus = {
  id: string;
  grid_id: string;
  user_id: string;
  bonus_definition: string;
  match_id: string; // ou number si tu veux changer plus tard
  parameters?: BonusParameters;
};

// 🟠 Bonus défini dans la table `bonus_definition`
export type BonusDef = {
  id: string;
  code: string;
  description: string;
  parameters?: BonusParameters;
};

// 🟠 Grille créée par l'admin ou récupérée par un joueur
export type Grid = {
  id: string;
  title: string;
  description: string;
  allowed_bonuses: string[]; // Ex: ['KANTE', 'ZLATAN']
};
