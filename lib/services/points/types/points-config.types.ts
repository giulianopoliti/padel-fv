/**
 * POINTS CONFIGURATION TYPES
 *
 * Defines point configurations for different tournament types
 */

export type TournamentType = 'AMERICAN' | 'LONG';

/**
 * Configuration for tournament points calculation
 */
export interface TournamentPointsConfig {
  /** Base points awarded to winner */
  baseWinner: number;

  /** Base points deducted from loser (negative value) */
  baseLoser: number;

  /** Bonus points for tournament champion */
  bonusChampion: number;

  /** Bonus points for tournament finalist */
  bonusFinalist: number;

  /** Minimum points a winner can receive */
  minWinnerPoints: number;

  /** Maximum points a winner can receive */
  maxWinnerPoints: number;

  /** Minimum points a loser can receive (most negative) */
  minLoserPoints: number;

  /** Maximum points a loser can receive (least negative) */
  maxLoserPoints: number;
}

/**
 * Predefined points configurations by tournament type
 */
export const POINTS_CONFIGS: Record<TournamentType, TournamentPointsConfig> = {
  AMERICAN: {
    baseWinner: 12,
    baseLoser: -8,
    bonusChampion: 30,
    bonusFinalist: 10,
    minWinnerPoints: 6,
    maxWinnerPoints: 24,
    minLoserPoints: -18,
    maxLoserPoints: -4
  },
  LONG: {
    baseWinner: 16,
    baseLoser: -12,
    bonusChampion: 60,
    bonusFinalist: 40,
    minWinnerPoints: 6,
    maxWinnerPoints: 36,
    minLoserPoints: -24,
    maxLoserPoints: -4
  }
};
