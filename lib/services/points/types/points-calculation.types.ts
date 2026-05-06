/**
 * POINTS CALCULATION TYPES
 *
 * Types for points calculation flow
 */

import { TournamentPointsConfig, TournamentType } from './points-config.types';

/**
 * Player snapshot from tournament start
 */
export interface PlayerSnapshot {
  playerId: string;
  playerName: string;
  score: number;
  category: string;
}

/**
 * Map of player snapshots for quick lookup
 */
export type PlayerSnapshotMap = Map<string, Omit<PlayerSnapshot, 'playerId'>>;

/**
 * Input for match points calculation
 */
export interface MatchPointsInput {
  matchId: string;
  winnerId: string;
  loserId: string;
  winnerAvgScore: number;
  loserAvgScore: number;
}

/**
 * Result of match points calculation
 */
export interface MatchPointsResult {
  matchId: string;
  winnerPoints: number;
  loserPoints: number;
  scoreDiff: number;
}

/**
 * Points earned by a player in a match
 */
export interface PlayerMatchPoints {
  playerId: string;
  playerName: string;
  points: number;
  matchId: string;
}

/**
 * Player points update for database
 */
export interface PlayerPointsUpdate {
  playerId: string;
  playerName: string;
  pointsEarned: number;
  bonus: number;
  totalPoints: number;
  currentScore: number;
  newScore: number;
}

/**
 * Match points for couple (for history tracking)
 * Schema matches database table: match_points_couples
 */
export interface MatchPointsCouple {
  id?: string;
  match_id: string;
  winner_couple_id: string;
  loser_couple_id: string;
  points_winner: number;  // ✅ DB column name
  points_loser: number;   // ✅ DB column name
  created_at?: string;
}

/**
 * Complete result of tournament points calculation
 */
export interface PointsCalculationResult {
  tournamentId: string;
  tournamentType: TournamentType;
  playerUpdates: PlayerPointsUpdate[];
  totalMatches: number;
  config: TournamentPointsConfig;
  matchPoints: Omit<MatchPointsCouple, 'id' | 'created_at'>[];
}

/**
 * Bonus application result
 */
export interface BonusApplicationResult {
  championIds: string[];
  finalistIds: string[];
  bonusApplied: boolean;
}
