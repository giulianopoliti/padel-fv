/**
 * Types and interfaces for zone position calculation system
 */

export interface PlayerData {
  id: string
  first_name: string
  last_name: string
  score: number
}

export interface CoupleData {
  id: string
  player1_id: string
  player2_id: string
  player1: PlayerData
  player2: PlayerData
}

export interface MatchData {
  id: string
  couple1_id: string
  couple2_id: string
  result_couple1: number | null
  result_couple2: number | null
  winner_id: string | null
  status: string
  zone_id: string
}

export interface HeadToHeadResult {
  coupleAId: string
  coupleBId: string
  winnerCoupleId: string | null
  matchPlayed: boolean
  couple1Score?: number
  couple2Score?: number
}

export interface CoupleStats {
  coupleId: string
  player1Name: string
  player2Name: string
  player1Score: number
  player2Score: number
  totalPlayerScore: number
  matchesWon: number
  matchesLost: number
  matchesPlayed: number
  setsWon: number
  setsLost: number
  setsDifference: number
  gamesWon: number
  gamesLost: number
  gamesDifference: number
  position: number
  positionTieInfo: string
}

export interface ZonePositionResult {
  couples: CoupleStats[]
  zoneCompleted: boolean
  totalCouples: number
  calculatedAt: Date
}

export enum TiebreakReason {
  NO_TIE = 'NO_TIE',
  HEAD_TO_HEAD = 'HEAD_TO_HEAD',
  GAMES_DIFFERENCE = 'GAMES_DIFFERENCE',
  PLAYER_SCORES = 'PLAYER_SCORES',
  GAMES_WON = 'GAMES_WON',
  RANDOM_TIEBREAKER = 'RANDOM_TIEBREAKER'
}

export interface TiebreakGroup {
  couples: CoupleStats[]
  reason: TiebreakReason
  resolved: boolean
}