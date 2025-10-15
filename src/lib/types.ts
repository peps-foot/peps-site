// Bonus Parameters typés
export type BonusParameters =
  | { picks: string[] }                         // KANTE
  | { match_win: string; match_zero: string }   // RIBERY
  | { pick: string };                           // ZLATAN

// Utilisateur Supabase
export type User = {
  id: string;
  email: string;
};

// Match brut depuis Supabase
export type Match = {
  id: string;
  date: string;
  home_team: string;
  away_team: string;
  fixture_id: number;
  league_id: number;
  status: string;
  is_locked: boolean;
  base_1_points: number | null;
  base_n_points: number | null;
  base_2_points: number | null;
  score_home: number | null;
  score_away: number | null;
  odd_1_snapshot: number | null;
  odd_n_snapshot: number | null;
  odd_2_snapshot: number | null;
  short_name_home?: string | null;
  short_name_away?: string | null;
};

// Grille
export type Grid = {
  id: string;
  title: string;
  description: string;
  allowed_bonuses: string[]; // UUID[]
};

export type RawMatchRow = {
  match_id: string;
  grid_id: string;
  pick?: '1' | 'N' | '2';
  points?: number;
  matches: Partial<Match>;
  grids: Partial<Grid>;
};

// Match lié à une grille (via table `grid_items`)
export type GridItem = {
  match_id: string;
};

// Grille enrichie avec ses `grid_items`
export type GridWithItems = Grid & {
  grid_items: GridItem[];
};

// Bonus
export type BonusDef = {
  id: string;
  code: 'KANTE' | 'RIBERY' | 'ZLATAN' | 'BIELSA';
  description: string;
  parameters?: BonusParameters;
};

export type GridBonus = {
  id: string;
  user_id: string;
  grid_id: string;
  bonus_definition: string;
  match_id: string;
  parameters: BonusParameters;
};

// Pick utilisateur
export type GridMatch = {
  id: string;
  user_id: string;
  grid_id: string;
  match_id: string;
  pick: '1' | 'N' | '2';
  points?: number;
};

// Match enrichi pour le front
export type MatchWithState = Match & {
  pick?: '1' | 'N' | '2';
  points?: number;
};

export type CompetitionMode = "CLASSIC" | "TOURNOI";

export type Competition = {
  id: string;
  name: string;
  description: string | null;
  icon?: string | null;
  mode: CompetitionMode; // ← ajouté
};
