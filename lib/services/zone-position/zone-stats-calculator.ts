/**
 * Zone Statistics Calculator
 * Calculates individual stats and head-to-head matrices for zone couples
 */

import type { CoupleData, MatchData, CoupleStats, HeadToHeadResult } from './types'
import { validateCoupleStats } from './utils'

export class ZoneStatsCalculator {
  
  /**
   * Calculates individual statistics for all couples in a zone
   */
  public calculateAllCoupleStats(
    couples: CoupleData[], 
    matches: MatchData[]
  ): CoupleStats[] {
    const stats: CoupleStats[] = []
    
    for (const couple of couples) {
      const coupleStats = this.calculateIndividualStats(couple, matches)
      
      // Validate consistency
      if (!validateCoupleStats(coupleStats)) {
        throw new Error(`Invalid stats calculated for couple ${couple.id}`)
      }
      
      stats.push(coupleStats)
    }
    
    return stats
  }
  
  /**
   * Calculates statistics for a single couple
   */
  public calculateIndividualStats(
    couple: CoupleData, 
    matches: MatchData[]
  ): CoupleStats {
    const stats: CoupleStats = {
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
      positionTieInfo: ''
    }
    
    // Find all matches where this couple participated
    const coupleMatches = matches.filter(match => 
      match.status === 'FINISHED' && 
      (match.couple1_id === couple.id || match.couple2_id === couple.id)
    )
    
    for (const match of coupleMatches) {
      if (match.result_couple1 === null || match.result_couple2 === null) {
        continue // Skip matches without results
      }
      
      stats.matchesPlayed++
      
      const isCouple1 = match.couple1_id === couple.id
      const coupleScore = this.parseScore(isCouple1 ? match.result_couple1 : match.result_couple2)
      const opponentScore = this.parseScore(isCouple1 ? match.result_couple2 : match.result_couple1)
      
      // Count games directly (result_couple1/2 are games, not sets)
      stats.gamesWon += coupleScore
      stats.gamesLost += opponentScore
      
      // Determine match winner
      if (match.winner_id === couple.id) {
        stats.matchesWon++
      } else {
        stats.matchesLost++
      }
      
      // For sets, we assume each match is 1 set in padel zone play
      // In zone matches, typically it's one set to determine winner
      if (match.winner_id === couple.id) {
        stats.setsWon += 1
      } else {
        stats.setsLost += 1
      }
    }
    
    // Calculate differences
    stats.setsDifference = stats.setsWon - stats.setsLost
    stats.gamesDifference = stats.gamesWon - stats.gamesLost
    
    return stats
  }
  
  /**
   * Creates a head-to-head matrix for all couple pairs
   */
  public createHeadToHeadMatrix(
    couples: CoupleData[], 
    matches: MatchData[]
  ): HeadToHeadResult[] {
    const matrix: HeadToHeadResult[] = []
    
    // Create all possible pair combinations
    for (let i = 0; i < couples.length; i++) {
      for (let j = 0; j < couples.length; j++) {
        if (i !== j) {
          const coupleA = couples[i]
          const coupleB = couples[j]
          
          const headToHead = this.findHeadToHeadMatch(coupleA.id, coupleB.id, matches)
          matrix.push(headToHead)
        }
      }
    }
    
    return matrix
  }
  
  /**
   * Finds head-to-head match between two specific couples
   */
  public findHeadToHeadMatch(
    coupleAId: string, 
    coupleBId: string, 
    matches: MatchData[]
  ): HeadToHeadResult {
    const match = matches.find(m => 
      m.status === 'FINISHED' &&
      ((m.couple1_id === coupleAId && m.couple2_id === coupleBId) ||
       (m.couple1_id === coupleBId && m.couple2_id === coupleAId))
    )
    
    if (!match || match.result_couple1 === null || match.result_couple2 === null) {
      return {
        coupleAId,
        coupleBId,
        winnerCoupleId: null,
        matchPlayed: false
      }
    }
    
    const isACouple1 = match.couple1_id === coupleAId
    const couple1Score = this.parseScore(match.result_couple1)
    const couple2Score = this.parseScore(match.result_couple2)
    
    return {
      coupleAId,
      coupleBId,
      winnerCoupleId: match.winner_id,
      matchPlayed: true,
      couple1Score: isACouple1 ? couple1Score : couple2Score,
      couple2Score: isACouple1 ? couple2Score : couple1Score
    }
  }
  
  /**
   * Helper method to safely convert string scores to numbers
   */
  private parseScore(score: string | number | null): number {
    if (score === null || score === undefined) return 0
    if (typeof score === 'number') return score
    const parsed = parseInt(score.toString(), 10)
    return isNaN(parsed) ? 0 : parsed
  }
}