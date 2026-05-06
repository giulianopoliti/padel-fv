/**
 * ELO POINTS CALCULATOR
 *
 * Calculates points using an ELO-like algorithm based on score differential
 */

import { TournamentPointsConfig } from '../types';

export class EloPointsCalculator {
  /**
   * Calculates points for a match using ELO-like algorithm
   *
   * Algorithm:
   * - Every 50 points of score difference = 1 step
   * - Winner adjustment: step * 1.5
   * - Loser adjustment: step * 1.0
   * - If winner was favorite (positive scoreDiff): receives less, loser loses less
   * - If winner was underdog (negative scoreDiff): receives more, loser loses more
   *
   * @param scoreDiff Average score difference (winner - loser)
   * @param config Points configuration for the tournament type
   * @returns Winner and loser points
   */
  static calculate(
    scoreDiff: number,
    config: TournamentPointsConfig
  ): { winnerPoints: number; loserPoints: number } {
    const BASE_WINNER = config.baseWinner;
    const BASE_LOSER = config.baseLoser;

    // Calculate adjustment steps
    const step = Math.floor(Math.abs(scoreDiff) / 50);
    const winnerAdjust = step * 1.5;
    const loserAdjust = step * 1.0;

    let winnerPoints: number;
    let loserPoints: number;

    if (scoreDiff > 0) {
      // Winner was favorite → receives less; loser loses less
      winnerPoints = BASE_WINNER - winnerAdjust;
      loserPoints = BASE_LOSER + loserAdjust;
    } else if (scoreDiff < 0) {
      // Winner was underdog → receives more; loser loses more
      winnerPoints = BASE_WINNER + winnerAdjust;
      loserPoints = BASE_LOSER - loserAdjust;
    } else {
      // Equal scores
      winnerPoints = BASE_WINNER;
      loserPoints = BASE_LOSER;
    }

    // Round to integers
    winnerPoints = Math.round(winnerPoints);
    loserPoints = Math.round(loserPoints);

    // Apply limits
    winnerPoints = Math.min(
      Math.max(winnerPoints, config.minWinnerPoints),
      config.maxWinnerPoints
    );
    loserPoints = Math.max(
      Math.min(loserPoints, config.maxLoserPoints),
      config.minLoserPoints
    );

    return { winnerPoints, loserPoints };
  }

  /**
   * Calculates expected outcome based on score difference
   * Used for statistics and analysis
   */
  static getExpectedOutcome(scoreDiff: number): number {
    return 1 / (1 + Math.pow(10, -scoreDiff / 400));
  }
}
