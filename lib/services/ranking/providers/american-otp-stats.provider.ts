/**
 * AMERICAN OTP TOURNAMENT STATS PROVIDER
 * (OTP = One Tournament/Zone - Single Zone American)
 * 
 * ⚠️  CRITICAL: This provider is NEW for single-zone American tournaments
 * ⚠️  SIMILAR TO: Regular American but with configurable ranking system
 * 
 * Purpose: Handle American-style tournaments with single zone configuration
 * Data interpretation:
 * - result_couple1/2 = games won (same as regular American)
 * - 1 set per match (same as regular American)
 * - Single zone instead of multiple zones
 * - Uses configurable ranking instead of hardcoded
 */

import type { CoupleData, MatchData } from '../../zone-position/types'
import type { ExtendedCoupleStats } from '../interfaces/stats-data-provider.interface'
import { BaseStatsDataProvider, type DataInterpretation } from './base-stats-data-provider'

/**
 * American OTP Tournament Stats Provider
 * 
 * Handles single-zone American tournaments where:
 * - All couples play in one large zone
 * - Match format is identical to regular American (1 set, games in result_couple1/2)
 * - Ranking system is configurable instead of hardcoded
 * - Suitable for smaller tournaments or different tournament structures
 */
export class AmericanOTPStatsProvider extends BaseStatsDataProvider {
  protected type = 'AMERICAN_OTP'
  
  protected getDataInterpretation(): DataInterpretation {
    return {
      resultCouple1Represents: 'games_won',
      resultCouple2Represents: 'games_won', 
      setsPerMatch: 1, // Same as regular American
      gamesSource: 'direct_from_result', // Same as regular American
      tournamentType: 'AMERICAN_OTP'
    }
  }
  
  /**
   * Calculate stats for a couple in American OTP format
   * Very similar to regular American but with enhanced tracking for configurable ranking
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
        tournamentType: 'AMERICAN_OTP',
        singleZone: true,
        matchDetails: {} // Store individual match results for head-to-head analysis
      },
      tiebreakDetails: []
    }
    
    // Find matches for this couple
    const coupleMatches = matches.filter(match => 
      match.status === 'FINISHED' && 
      (match.couple1_id === couple.id || match.couple2_id === couple.id)
    )
    
    // Process each match
    for (const match of coupleMatches) {
      if (match.result_couple1 === null || match.result_couple2 === null) {
        continue // Skip matches without results
      }
      
      stats.matchesPlayed++
      
      const isCouple1 = match.couple1_id === couple.id
      
      // ✅ GAMES: Direct from result_couple1/2 (same as regular American)
      const coupleGames = this.parseScore(isCouple1 ? match.result_couple1 : match.result_couple2)
      const opponentGames = this.parseScore(isCouple1 ? match.result_couple2 : match.result_couple1)
      
      stats.gamesWon += coupleGames
      stats.gamesLost += opponentGames
      
      // ✅ SETS: 1 set per match (same as regular American)
      const matchWon = match.winner_id === couple.id
      if (matchWon) {
        stats.matchesWon++
        stats.setsWon += 1
      } else {
        stats.matchesLost++
        stats.setsLost += 1
      }
      
      // Store individual match details for enhanced head-to-head analysis
      const opponentId = isCouple1 ? match.couple2_id : match.couple1_id
      if (stats.customStats?.matchDetails) {
        stats.customStats.matchDetails[match.id] = {
          opponentId,
          coupleGames,
          opponentGames,
          won: matchWon,
          gamesDifference: coupleGames - opponentGames
        }
      }
    }
    
    // Calculate differences
    stats.setsDifference = stats.setsWon - stats.setsLost
    stats.gamesDifference = stats.gamesWon - stats.gamesLost
    
    // Validate stats consistency
    if (!this.validateStats(stats)) {
      console.warn(`Invalid stats calculated for couple ${couple.id} in AMERICAN_OTP tournament`)
    }
    
    return stats
  }
  
  /**
   * Enhanced head-to-head matrix for single zone tournaments
   * In single-zone tournaments, head-to-head is more important since everyone plays everyone
   */
  async createHeadToHeadMatrix(couples: CoupleData[], matches: MatchData[]) {
    const matrix = await super.createHeadToHeadMatrix(couples, matches)
    
    // In single-zone American OTP, we can provide more detailed head-to-head analysis
    for (const h2h of matrix) {
      if (h2h.matchPlayed) {
        const match = matches.find(m => 
          ((m.couple1_id === h2h.coupleAId && m.couple2_id === h2h.coupleBId) ||
           (m.couple1_id === h2h.coupleBId && m.couple2_id === h2h.coupleAId))
        )
        
        if (match && match.result_couple1 !== null && match.result_couple2 !== null) {
          const isACouple1 = match.couple1_id === h2h.coupleAId
          const coupleAGames = this.parseScore(isACouple1 ? match.result_couple1 : match.result_couple2)
          const coupleBGames = this.parseScore(isACouple1 ? match.result_couple2 : match.result_couple1)
          
          // Store games instead of sets for American format
          h2h.couple1Score = coupleAGames
          h2h.couple2Score = coupleBGames
        }
      }
    }
    
    return matrix
  }
  
  /**
   * American OTP supports similar statistics to regular American
   * But with enhanced head-to-head capabilities due to single zone format
   */
  getSupportedStatistics(): string[] {
    return [
      'wins',
      'losses',
      'games_difference',    // Primary criterion for American tournaments
      'games_for',
      'games_against',
      'head_to_head',        // Very important in single zone
      'player_scores',
      'sets_for',           // Always equals matches won
      'sets_against',       // Always equals matches lost  
      'sets_difference',    // Always equals games difference pattern
      // American OTP specific
      'win_percentage',     // wins / total_matches
      'games_per_match',    // average games per match
      'consistency_score'   // measure of performance consistency
    ]
  }
  
  /**
   * Enhanced validation considering single-zone characteristics
   */
  protected validateStats(stats: ExtendedCoupleStats): boolean {
    const baseValid = super.validateStats(stats)
    
    // In American tournaments, sets won/lost should equal matches won/lost
    const setsMatchesConsistency = (
      stats.setsWon === stats.matchesWon &&
      stats.setsLost === stats.matchesLost
    )
    
    // Games should be reasonable (typically 6-8 games per match in padel)
    const reasonableGames = stats.matchesPlayed === 0 || 
      (stats.gamesWon / stats.matchesPlayed >= 3 && 
       stats.gamesWon / stats.matchesPlayed <= 12)
    
    if (!setsMatchesConsistency) {
      console.warn(`Sets/matches inconsistency for couple ${stats.coupleId}: ${stats.setsWon}/${stats.matchesWon} sets/matches won`)
    }
    
    if (!reasonableGames) {
      console.warn(`Unreasonable games per match for couple ${stats.coupleId}: ${stats.gamesWon / stats.matchesPlayed} avg games/match`)
    }
    
    return baseValid && setsMatchesConsistency && reasonableGames
  }
  
  /**
   * Calculate additional American OTP specific statistics
   */
  public calculateExtendedStats(stats: ExtendedCoupleStats): ExtendedCoupleStats {
    if (stats.customStats) {
      // Win percentage
      stats.customStats.winPercentage = stats.matchesPlayed > 0 ? 
        (stats.matchesWon / stats.matchesPlayed) * 100 : 0
      
      // Average games per match
      stats.customStats.gamesPerMatch = stats.matchesPlayed > 0 ? 
        stats.gamesWon / stats.matchesPlayed : 0
      
      // Consistency score based on games difference variance
      if (stats.customStats.matchDetails) {
        const gamesDifferences = Object.values(stats.customStats.matchDetails as any)
          .map((match: any) => match.gamesDifference)
        
        const avgDiff = gamesDifferences.reduce((sum: number, diff: number) => sum + diff, 0) / gamesDifferences.length
        const variance = gamesDifferences.reduce((sum: number, diff: number) => sum + Math.pow(diff - avgDiff, 2), 0) / gamesDifferences.length
        
        stats.customStats.consistencyScore = Math.max(0, 100 - Math.sqrt(variance) * 10) // Scale 0-100
      }
    }
    
    return stats
  }
}