export type Match = {
  id: number;
  home_team: string;
  away_team: string;
  date: string;
  score_home: number | null;
  score_away: number | null;
  status: string;
};

export type GridBonus = {
  id: string;
  grid_id: string;
  user_id: string;
  bonus_definition: string;
  match_id: string;
  parameters: { [key: string]: string };
};

export type BonusDef = {
  id: string;
  code: string;
  description: string;
  parameters?: {
    match_win?: string;
    match_zero?: string;
  };
};
