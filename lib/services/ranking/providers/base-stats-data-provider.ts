/**
 * BASE STATS DATA PROVIDER
 * 
 * ⚠️  CRITICAL: This provider is NEW and does not affect existing American tournament system
 * ⚠️  BACKWARD COMPATIBILITY: 100% preserved - American tournaments continue using ZoneStatsCalculator
 * 
 * Purpose: Base class for tournament-specific data providers
 */

import { createClient } from '@/utils/supabase/server'
import type { 
  StatsDataProvider, 
  ExtendedCoupleStats, 
  SetData 
} from '../interfaces/stats-data-provider.interface'
import type { CoupleData, MatchData, HeadToHeadResult } from '../../zone-position/types'

/**
 * Configuration for how to interpret match result data
 */
export interface DataInterpretation {
  /** What result_couple1 represents in matches table */
  resultCouple1Represents: 'games_won' | 'sets_won'
  
  /** What result_couple2 represents in matches table */  
  resultCouple2Represents: 'games_won' | 'sets_won'
  
  /** Number of sets per match, or 'variable' for best-of-3 */
  setsPerMatch: number | 'variable'
  
  /** Where to get detailed game data */
  gamesSource: 'direct_from_result' | 'set_matches_table'
  
  /** Tournament type identifier */
  tournamentType: string
}

/**
 * Base implementation of StatsDataProvider with common functionality
 */
export abstract class BaseStatsDataProvider implements StatsDataProvider {
  protected abstract type: string
  
  /**
   * Each provider defines how to interpret the data for its tournament type
   */
  protected abstract getDataInterpretation(): DataInterpretation
  
  getTournamentType(): string {
    return this.type
  }
  
  /**
   * Template method - subclasses can override specific parts
   */
  async calculateCoupleStats(couple: CoupleData, matches: MatchData[]): Promise<ExtendedCoupleStats> {
    const interpretation = this.getDataInterpretation()
    
    // Initialize base stats structure
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
      customStats: {},
      tiebreakDetails: []
    }
    
    // Find matches for this couple
    const coupleMatches = matches.filter(match => 
      match.status === 'FINISHED' && 
      (match.couple1_id === couple.id || match.couple2_id === couple.id)
    )
    
    // Process each match according to tournament type
    for (const match of coupleMatches) {
      await this.processMatch(match, couple, stats, interpretation)
    }
    
    // Calculate differences
    stats.setsDifference = stats.setsWon - stats.setsLost
    stats.gamesDifference = stats.gamesWon - stats.gamesLost
    
    // Validate stats consistency
    if (!this.validateStats(stats)) {
      console.warn(`Invalid stats calculated for couple ${couple.id} in ${this.type} tournament`)
    }
    
    return stats
  }
  
  /**
   * Process a single match - can be overridden by subclasses for specific logic
   */
  protected async processMatch(
    match: MatchData, 
    couple: CoupleData, 
    stats: ExtendedCoupleStats,
    interpretation: DataInterpretation
  ): Promise<void> {
    if (match.result_couple1 === null || match.result_couple2 === null) {
      return // Skip matches without results
    }
    
    stats.matchesPlayed++
    
    const isCouple1 = match.couple1_id === couple.id
    const coupleResult = this.parseScore(isCouple1 ? match.result_couple1 : match.result_couple2)
    const opponentResult = this.parseScore(isCouple1 ? match.result_couple2 : match.result_couple1)
    
    // Process based on data interpretation
    if (interpretation.resultCouple1Represents === 'games_won') {
      await this.processGamesBasedMatch(match, couple, stats, coupleResult, opponentResult)
    } else if (interpretation.resultCouple1Represents === 'sets_won') {
      await this.processSetsBasedMatch(match, couple, stats, coupleResult, opponentResult)
    }
    
    // Determine match winner
    const matchWon = this.determineMatchWinner(coupleResult, opponentResult, interpretation)
    if (matchWon) {
      stats.matchesWon++
    } else {
      stats.matchesLost++
    }
  }
  
  /**
   * Process match where result_couple1/2 represents games won
   * Used by: AMERICAN tournaments
   */
  protected async processGamesBasedMatch(
    match: MatchData,
    couple: CoupleData,
    stats: ExtendedCoupleStats,
    coupleGames: number,
    opponentGames: number
  ): Promise<void> {
    // Direct games from result
    stats.gamesWon += coupleGames
    stats.gamesLost += opponentGames
    
    // Sets are typically 1 per match in American tournaments
    if (match.winner_id === couple.id) {
      stats.setsWon += 1
    } else {
      stats.setsLost += 1
    }
  }
  
  /**
   * Process match where result_couple1/2 represents sets won
   * Used by: LONG tournaments
   */
  protected async processSetsBasedMatch(
    match: MatchData,
    couple: CoupleData,
    stats: ExtendedCoupleStats,
    coupleSets: number,
    opponentSets: number
  ): Promise<void> {
    // Direct sets from result
    stats.setsWon += coupleSets
    stats.setsLost += opponentSets
    
    // Games need to come from set_matches table
    const setMatches = await this.getSetMatches(match.id)
    for (const setMatch of setMatches) {
      const isCouple1 = match.couple1_id === couple.id
      const coupleGames = isCouple1 ? setMatch.couple1_games : setMatch.couple2_games
      const opponentGames = isCouple1 ? setMatch.couple2_games : setMatch.couple1_games
      
      stats.gamesWon += coupleGames
      stats.gamesLost += opponentGames
    }
  }
  
  /**
   * Determine if couple won the match based on tournament type
   */
  protected determineMatchWinner(
    coupleScore: number, 
    opponentScore: number, 
    interpretation: DataInterpretation
  ): boolean {
    if (interpretation.resultCouple1Represents === 'sets_won') {
      // In set-based tournaments, more sets = match win
      return coupleScore > opponentScore
    } else {
      // In games-based tournaments, use winner_id (already processed)
      // This is a fallback - the actual winner determination should come from match.winner_id
      return coupleScore > opponentScore
    }
  }
  
  /**
   * Get detailed set data for a match
   */
  protected async getSetMatches(matchId: string): Promise<SetData[]> {
    try {
      const supabase = await createClient()
      
      const { data, error } = await supabase
        .from('set_matches')
        .select('*')
        .eq('match_id', matchId)
        .order('set_number', { ascending: true })
      
      if (error) {
        console.warn(`Failed to fetch set matches for ${matchId}:`, error.message)
        return []
      }
      
      return data || []
    } catch (error) {
      console.warn(`Error fetching set matches for ${matchId}:`, error)
      return []
    }
  }
  
  /**
   * Default implementation for calculateAllCoupleStats
   */
  async calculateAllCoupleStats(couples: CoupleData[], matches: MatchData[]): Promise<ExtendedCoupleStats[]> {
    const results: ExtendedCoupleStats[] = []
    
    for (const couple of couples) {
      const stats = await this.calculateCoupleStats(couple, matches)
      results.push(stats)
    }
    
    return results
  }
  
  /**
   * Default implementation for createHeadToHeadMatrix
   * This logic is mostly reusable across tournament types
   */
  async createHeadToHeadMatrix(couples: CoupleData[], matches: MatchData[]): Promise<HeadToHeadResult[]> {
    const matrix: HeadToHeadResult[] = []
    
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
   * Find head-to-head match between two couples
   * Reusable across tournament types
   */
  protected findHeadToHeadMatch(
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
   * Validate calculated stats for consistency
   */
  protected validateStats(stats: ExtendedCoupleStats): boolean {
    return (
      stats.matchesPlayed === stats.matchesWon + stats.matchesLost &&
      stats.setsDifference === stats.setsWon - stats.setsLost &&
      stats.gamesDifference === stats.gamesWon - stats.gamesLost &&
      stats.totalPlayerScore === stats.player1Score + stats.player2Score
    )
  }
  
  /**
   * Helper method to safely parse scores
   */
  protected parseScore(score: string | number | null): number {
    if (score === null || score === undefined) return 0
    if (typeof score === 'number') return score
    const parsed = parseInt(score.toString(), 10)
    return isNaN(parsed) ? 0 : parsed
  }
  
  /**
   * Default supported statistics - can be overridden by subclasses
   */
  getSupportedStatistics(): string[] {
    return [
      'wins',
      'losses', 
      'sets_difference',
      'sets_for',
      'sets_against',
      'games_difference', 
      'games_for',
      'games_against',
      'head_to_head',
      'player_scores'
    ]
  }
}