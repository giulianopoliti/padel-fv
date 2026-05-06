/**
 * MATCH POINTS CALCULATOR
 *
 * Calculates points for individual matches
 */

import { EloPointsCalculator } from './elo-points.calculator';
import {
  TournamentPointsConfig,
  PlayerSnapshotMap,
  PlayerMatchPoints
} from '../types';

export class MatchPointsCalculator {
  /**
   * Calculates points for all players in a match
   *
   * @param match Match data from database
   * @param snapshotMap Player snapshot map (scores at tournament start)
   * @param config Points configuration
   * @param supabase Supabase client
   * @returns Array of points for each player
   */
  static async calculateForMatch(
    match: any,
    snapshotMap: PlayerSnapshotMap,
    config: TournamentPointsConfig,
    supabase: any
  ): Promise<PlayerMatchPoints[]> {
    // Get couple compositions
    const { data: winnerCouple, error: winnerError } = await supabase
      .from('couples')
      .select('id, player1_id, player2_id')
      .eq('id', match.winner_id)
      .single();

    const losingCoupleId =
      match.couple1_id === match.winner_id ? match.couple2_id : match.couple1_id;

    const { data: loserCouple, error: loserError } = await supabase
      .from('couples')
      .select('id, player1_id, player2_id')
      .eq('id', losingCoupleId)
      .single();

    if (winnerError || loserError || !winnerCouple || !loserCouple) {
      console.error('[MatchPointsCalculator] Error fetching couples');
      return [];
    }

    // Get player data from snapshot
    const getPlayerData = (playerId: string | null) => {
      if (!playerId) {
        return { id: '', score: 0, playerName: 'Unknown' };
      }

      const data = snapshotMap.get(playerId);
      if (!data) {
        console.warn(
          `[MatchPointsCalculator] Player ${playerId} not found in snapshot, defaulting to 0`
        );
        return { id: playerId, score: 0, playerName: 'No snapshot' };
      }

      return {
        id: playerId,
        score: data.score,
        playerName: data.playerName
      };
    };

    const wp1 = getPlayerData(winnerCouple.player1_id);
    const wp2 = getPlayerData(winnerCouple.player2_id);
    const lp1 = getPlayerData(loserCouple.player1_id);
    const lp2 = getPlayerData(loserCouple.player2_id);

    // Calculate average scores using snapshot data
    const winnerAvgScore = (wp1.score + wp2.score) / 2;
    const loserAvgScore = (lp1.score + lp2.score) / 2;
    const scoreDiff = winnerAvgScore - loserAvgScore;

    // Calculate points using ELO algorithm
    const { winnerPoints, loserPoints } = EloPointsCalculator.calculate(
      scoreDiff,
      config
    );

    // Return points for all 4 players
    return [
      // Winners
      {
        playerId: wp1.id,
        points: winnerPoints,
        matchId: match.id,
        playerName: wp1.playerName
      },
      {
        playerId: wp2.id,
        points: winnerPoints,
        matchId: match.id,
        playerName: wp2.playerName
      },
      // Losers
      {
        playerId: lp1.id,
        points: loserPoints,
        matchId: match.id,
        playerName: lp1.playerName
      },
      {
        playerId: lp2.id,
        points: loserPoints,
        matchId: match.id,
        playerName: lp2.playerName
      }
    ];
  }
}
