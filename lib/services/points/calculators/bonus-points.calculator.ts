/**
 * BONUS POINTS CALCULATOR
 *
 * Calculates and applies bonus points for tournament winners and finalists
 */

import { TournamentPointsConfig, BonusApplicationResult } from '../types';

export class BonusPointsCalculator {
  /**
   * Applies bonus points to tournament winner and finalist
   *
   * @param matches All tournament matches
   * @param playerPoints Map of player points (will be mutated)
   * @param config Points configuration
   * @param supabase Supabase client
   * @returns Result with champion and finalist IDs
   */
  static async applyFinalBonuses(
    matches: any[],
    playerPoints: Map<string, { earned: number; bonus: number }>,
    config: TournamentPointsConfig,
    supabase: any
  ): Promise<BonusApplicationResult> {
    const result: BonusApplicationResult = {
      championIds: [],
      finalistIds: [],
      bonusApplied: false
    };

    // Find the final match
    const finalMatch = matches.find((m: any) => m.round === 'FINAL');

    if (!finalMatch || !finalMatch.winner_id) {
      console.warn('[BonusPointsCalculator] No final match found or no winner');
      return result;
    }

    const winnerCoupleId = finalMatch.winner_id;
    const loserCoupleId =
      finalMatch.couple1_id === winnerCoupleId
        ? finalMatch.couple2_id
        : finalMatch.couple1_id;

    // Get winner couple (champion)
    const { data: winnerCouple, error: winnerError } = await supabase
      .from('couples')
      .select(`
        id,
        player1:players!couples_player1_id_fkey(id, first_name, last_name),
        player2:players!couples_player2_id_fkey(id, first_name, last_name)
      `)
      .eq('id', winnerCoupleId)
      .single();

    // Get loser couple (finalist)
    const { data: finalistCouple, error: finalistError } = await supabase
      .from('couples')
      .select(`
        id,
        player1:players!couples_player1_id_fkey(id, first_name, last_name),
        player2:players!couples_player2_id_fkey(id, first_name, last_name)
      `)
      .eq('id', loserCoupleId)
      .single();

    if (winnerError || finalistError || !winnerCouple || !finalistCouple) {
      console.error('[BonusPointsCalculator] Error fetching final couples');
      return result;
    }

    // Apply champion bonus
    [winnerCouple.player1, winnerCouple.player2].forEach((p: any) => {
      if (p && p.id && playerPoints.has(p.id)) {
        const points = playerPoints.get(p.id)!;
        points.bonus += config.bonusChampion;
        result.championIds.push(p.id);
      }
    });

    // Apply finalist bonus
    [finalistCouple.player1, finalistCouple.player2].forEach((p: any) => {
      if (p && p.id && playerPoints.has(p.id)) {
        const points = playerPoints.get(p.id)!;
        points.bonus += config.bonusFinalist;
        result.finalistIds.push(p.id);
      }
    });

    result.bonusApplied = true;

    console.log(
      `[BonusPointsCalculator] Applied bonuses: ${result.championIds.length} champions (+${config.bonusChampion}), ${result.finalistIds.length} finalists (+${config.bonusFinalist})`
    );

    return result;
  }

  /**
   * Checks if a player received a bonus
   */
  static hasBonus(
    playerId: string,
    bonusResult: BonusApplicationResult
  ): { hasBonus: boolean; type?: 'champion' | 'finalist' } {
    if (bonusResult.championIds.includes(playerId)) {
      return { hasBonus: true, type: 'champion' };
    }
    if (bonusResult.finalistIds.includes(playerId)) {
      return { hasBonus: true, type: 'finalist' };
    }
    return { hasBonus: false };
  }
}
