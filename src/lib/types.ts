export type Match = {
  id: number;
  home_team: string;
  away_team: string;
  date: string;
  score_home: number | null;
  score_away: number | null;
  status: string;
};

export type BonusParameters =
  | { picks: string[] }
  | { match_win: string; match_zero: string }
  | { pick: string };

export type GridBonus = {
  id: string;
  grid_id: string;
  user_id: string;
  bonus_definition: string;
  match_id: string; // ou number si c'est l'ID du match
  parameters?: BonusParameters;
};

export type BonusDef = {
  id: string;
  code: string;
  description: string;
  parameters?: BonusParameters;
};

export { BonusParameters };
