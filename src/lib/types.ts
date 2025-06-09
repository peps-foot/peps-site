// 🟠 Match récupéré depuis Supabase (via api-football)
export type Match = {
  id: string; // uuid
  fixture_id: number;
  league_id: number;
  date: string; // timestamp
  home_team: string;
  away_team: string;
  score_home: number | null;
  score_away: number | null;
  status: string;
  is_locked: boolean;

  odd_1_snapshot: number | null;
  odd_n_snapshot: number | null;
  odd_2_snapshot: number | null;

  base_1_points: number | null;
  base_n_points: number | null;
  base_2_points: number | null;

  // Champs enrichis localement
  odd_1?: number | null;
  odd_X?: number | null;
  odd_2?: number | null;
  pick?: string;
  points?: number;
};

// 🟠 Match enrichi utilisé dans page.tsx (fusion de Match + données grille + ID)
export type MatchWithOdds = Match & {
  match_id: string;  // identifiant depuis grid_items
  grid_id: string;   // identifiant de la grille à laquelle le match appartient
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
  | { pick: string };                              // Bonus Zlatan

// 🟠 Bonus joué par un joueur sur une grille
export type GridBonus = {
  id: string;
  grid_id: string;
  user_id: string;
  bonus_definition: string;
  match_id: string;
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
