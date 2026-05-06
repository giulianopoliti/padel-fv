export interface PlayerInfo {
  id: string
  first_name: string | null
  last_name: string | null
  score: number | null
  dni?: string | null
  phone?: string | null
}

export interface CoupleInfo {
  id: string
  tournament_id: string
  player_1_id: string | null
  player_2_id: string | null
  created_at: string
  player_1_info: PlayerInfo | null
  player_2_info: PlayerInfo | null
  total_score?: number
  zone?: string
  position?: number
}

export interface MatchInfo {
  id: string
  tournament_id: string
  couple1_id: string
  couple2_id: string
  result_couple1?: number | null
  result_couple2?: number | null
  round: string
  zone?: string
  winner_id?: string | null
  status: "PENDING" | "FINISHED"
  couple1?: CoupleInfo
  couple2?: CoupleInfo
  couple1_name?: string
  couple2_name?: string
}

export interface Standing {
  team_id: string;
  zone: string;
  points: number;
  wins: number;
  losses: number;
  ties: number;
  matches_played: number;
  score_difference: number;
  // Add couple_name or similar if you plan to display it directly from standings
  // couple_name?: string; 
} 