/**
 * LONG TOURNAMENT STATS PROVIDER
 * 
 * ⚠️  CRITICAL: This provider is NEW and implements 3-set tournament logic
 * ⚠️  ZERO IMPACT: Does not affect existing American tournament system
 * 
 * Purpose: Calculate statistics for long tournaments with multiple sets per match
 * Data interpretation: 
 * - result_couple1/2 = sets won (e.g., "2", "1" for a 2-1 match)
 * - Games come from set_matches table with detailed set-by-set data
 */

import type { CoupleData, MatchData } from '../../zone-position/types'
import type { ExtendedCoupleStats } from '../interfaces/stats-data-provider.interface'
import { BaseStatsDataProvider, type DataInterpretation } from './base-stats-data-provider'

/**
 * Long Tournament Stats Provider
 * 
 * Handles tournaments where:
 * - Matches are best of 3 sets (can end 2-0 or 2-1)
 * - result_couple1/2 stores sets won, not games
 * - Detailed games data is stored in set_matches table
 */
export class LongTournamentStatsProvider extends BaseStatsDataProvider {
  protected type = 'LONG'
  
  protected getDataInterpretation(): DataInterpretation {
    return {
      resultCouple1Represents: 'sets_won',
      resultCouple2Represents: 'sets_won',
      setsPerMatch: 'variable', // Can be 2 or 3 sets depending on result
      gamesSource: 'set_matches_table',
      tournamentType: 'LONG'
    }
  }
  
  /**
   * Calculate stats for a couple in long tournament format
   * Override base implementation for specific long tournament logic
   */
  async calculateCoupleStats(couple: CoupleData, matches: MatchData[]): Promise<ExtendedCoupleStats> {
    const stats: ExtendedCoupleStats = {
      coupleId: couple.id,
      player1Name: `${couple.player1.first_name} ${couple.player1.last_name}`.trim(),
      player2Name: `${couple.player2.first_name} ${couple.player2.last_name}`.trim(),
      player1Score: couple.player1.score,
      player2Score: couple.player2.score,
      totalPlayerScore: couple.player1.score + couple.player2.score,
      matchesWon: 0,
      matchesLost: 0,
      matchesPlayed: 0,
      setsWon: 0,
      setsLost: 0,
      setsDifference: 0,
      gamesWon: 0,
      gamesLost: 0,
      gamesDifference: 0,
      position: 0,
      positionTieInfo: '',
      customStats: {
        tournamentType: 'LONG',
        setsBreakdown: {}, // Will store set-by-set details
        averageSetsPerMatch: 0
      },
      tiebreakDetails: []
    }
    
    // Find matches for this couple
    const coupleMatches = matches.filter(match => 
      match.status === 'FINISHED' && 
      (match.couple1_id === couple.id || match.couple2_id === couple.id)
    )
    
    let totalSetsPlayed = 0
    
    // Process each match
    for (const match of coupleMatches) {
      if (match.result_couple1 === null || match.result_couple2 === null) {
        continue // Skip matches without results
      }
      
      stats.matchesPlayed++
      
      const isCouple1 = match.couple1_id === couple.id
      
      // ✅ SETS: Get from result_couple1/2 (e.g., "2" vs "1")
      const coupleSets = this.parseScore(isCouple1 ? match.result_couple1 : match.result_couple2)
      const opponentSets = this.parseScore(isCouple1 ? match.result_couple2 : match.result_couple1)
      
      stats.setsWon += coupleSets
      stats.setsLost += opponentSets
      totalSetsPlayed += coupleSets + opponentSets
      
      // ✅ GAMES: Get detailed data from set_matches table
      const setMatches = await this.getSetMatches(match.id)
      const matchGamesData = {
        matchId: match.id,
        sets: [] as any[],
        totalGamesWon: 0,
        totalGamesLost: 0
      }
      
      for (const setMatch of setMatches) {
        const isCouple1InSet = match.couple1_id === couple.id
        const coupleGamesInSet = isCouple1InSet ? setMatch.couple1_games : setMatch.couple2_games
        const opponentGamesInSet = isCouple1InSet ? setMatch.couple2_games : setMatch.couple1_games
        
        stats.gamesWon += coupleGamesInSet
        stats.gamesLost += opponentGamesInSet
        
        matchGamesData.totalGamesWon += coupleGamesInSet
        matchGamesData.totalGamesLost += opponentGamesInSet
        matchGamesData.sets.push({
          setNumber: setMatch.set_number,
          coupleGames: coupleGamesInSet,
          opponentGames: opponentGamesInSet,
          won: setMatch.winner_couple_id === couple.id
        })
      }
      
      // Store detailed match data for analysis
      if (stats.customStats?.setsBreakdown) {
        stats.customStats.setsBreakdown[match.id] = matchGamesData
      }
      
      // ✅ MATCH WINNER: Determine from sets won (best of 3)
      if (coupleSets > opponentSets) {
        stats.matchesWon++
      } else {
        stats.matchesLost++
      }
    }
    
    // Calculate differences
    stats.setsDifference = stats.setsWon - stats.setsLost
    stats.gamesDifference = stats.gamesWon - stats.gamesLost
    
    // Calculate average sets per match
    if (stats.customStats && stats.matchesPlayed > 0) {
      stats.customStats.averageSetsPerMatch = totalSetsPlayed / stats.matchesPlayed
    }
    
    // Validate stats consistency
    if (!this.validateStats(stats)) {
      console.warn(`Invalid stats calculated for couple ${couple.id} in LONG tournament`)
    }
    
    return stats
  }
  
  /**
   * Override head-to-head for long tournament specifics
   * In long tournaments, head-to-head comparison should consider sets, not just match result
   */
  async createHeadToHeadMatrix(couples: CoupleData[], matches: MatchData[]) {
    const matrix = await super.createHeadToHeadMatrix(couples, matches)
    
    // Enhance head-to-head results with set information for long tournaments
    for (const h2h of matrix) {
      if (h2h.matchPlayed) {
        const match = matches.find(m => 
          ((m.couple1_id === h2h.coupleAId && m.couple2_id === h2h.coupleBId) ||
           (m.couple1_id === h2h.coupleBId && m.couple2_id === h2h.coupleAId))
        )
        
        if (match) {
          // Add set information to head-to-head result
          const isACouple1 = match.couple1_id === h2h.coupleAId
          const coupleSets = this.parseScore(isACouple1 ? match.result_couple1 : match.result_couple2)
          const opponentSets = this.parseScore(isACouple1 ? match.result_couple2 : match.result_couple1)
          
          // Store set scores in the head-to-head result
          h2h.couple1Score = coupleSets
          h2h.couple2Score = opponentSets
        }
      }
    }
    
    return matrix
  }
  
  /**
   * Long tournaments support advanced statistics including set-level data
   */
  getSupportedStatistics(): string[] {
    return [
      'wins',
      'losses',
      'sets_difference',   // Key for long tournaments
      'sets_for',
      'sets_against', 
      'games_difference',
      'games_for',
      'games_against',
      'head_to_head',
      'player_scores',
      // Long tournament specific stats
      'sets_win_rate',     // sets_won / (sets_won + sets_lost)
      'games_per_set',     // average games per set
      'sets_per_match'     // average sets per match
    ]
  }
  
  /**
   * Enhanced validation for long tournament stats
   */
  protected validateStats(stats: ExtendedCoupleStats): boolean {
    const baseValid = super.validateStats(stats)
    
    // Additional validations for long tournament
    const setsValid = stats.setsWon >= 0 && stats.setsLost >= 0
    const setsReasonable = stats.setsWon <= stats.matchesPlayed * 3 // Max 3 sets per match
    const gamesReasonable = stats.gamesWon >= stats.setsWon * 4 // Min ~4 games per set won (6-4, 6-3, etc.)
    
    if (!setsValid) {
      console.warn(`Invalid sets count for couple ${stats.coupleId}: ${stats.setsWon}/${stats.setsLost}`)
    }
    
    if (!setsReasonable) {
      console.warn(`Unreasonable sets count for couple ${stats.coupleId}: ${stats.setsWon} sets in ${stats.matchesPlayed} matches`)
    }
    
    if (!gamesReasonable) {
      console.warn(`Unreasonable games count for couple ${stats.coupleId}: ${stats.gamesWon} games for ${stats.setsWon} sets`)
    }
    
    return baseValid && setsValid && setsReasonable && gamesReasonable
  }
}