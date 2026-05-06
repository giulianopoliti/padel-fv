/**
 * AMERICAN TOURNAMENT STATS PROVIDER
 * 
 * ⚠️  CRITICAL: This provider is a WRAPPER around existing ZoneStatsCalculator
 * ⚠️  ZERO BREAKING CHANGES: Delegates all logic to existing, battle-tested code
 * ⚠️  PERFORMANCE: Same performance as existing system - no overhead
 * 
 * Purpose: Provide interface compatibility while preserving existing American tournament logic
 */

import type { CoupleData, MatchData } from '../../zone-position/types'
import type { ExtendedCoupleStats } from '../interfaces/stats-data-provider.interface'
import { BaseStatsDataProvider, type DataInterpretation } from './base-stats-data-provider'

// Import existing system - NO MODIFICATIONS to existing code
import { ZoneStatsCalculator } from '../../zone-position/zone-stats-calculator'

/**
 * American Tournament Stats Provider
 * 
 * This provider WRAPS the existing ZoneStatsCalculator to provide interface compatibility
 * while maintaining 100% backward compatibility and zero performance impact.
 */
export class AmericanTournamentStatsProvider extends BaseStatsDataProvider {
  protected type = 'AMERICAN'
  private existingCalculator: ZoneStatsCalculator
  
  constructor() {
    super()
    // ✅ Use existing, optimized calculator
    this.existingCalculator = new ZoneStatsCalculator()
  }
  
  protected getDataInterpretation(): DataInterpretation {
    return {
      resultCouple1Represents: 'games_won',
      resultCouple2Represents: 'games_won',
      setsPerMatch: 1, // American tournaments = 1 set per match
      gamesSource: 'direct_from_result',
      tournamentType: 'AMERICAN'
    }
  }
  
  /**
   * CRITICAL: Delegate to existing ZoneStatsCalculator
   * This ensures ZERO changes to American tournament behavior
   */
  async calculateCoupleStats(couple: CoupleData, matches: MatchData[]): Promise<ExtendedCoupleStats> {
    // ✅ DELEGATE to existing, battle-tested code
    const existingStats = this.existingCalculator.calculateIndividualStats(couple, matches)
    
    // ✅ CONVERT to ExtendedCoupleStats format while preserving all data
    const extendedStats: ExtendedCoupleStats = {
      // Copy all existing fields exactly as they are
      coupleId: existingStats.coupleId,
      player1Name: existingStats.player1Name,
      player2Name: existingStats.player2Name,
      player1Score: existingStats.player1Score,
      player2Score: existingStats.player2Score,
      totalPlayerScore: existingStats.totalPlayerScore,
      matchesWon: existingStats.matchesWon,
      matchesLost: existingStats.matchesLost,
      matchesPlayed: existingStats.matchesPlayed,
      setsWon: existingStats.setsWon,
      setsLost: existingStats.setsLost,
      setsDifference: existingStats.setsDifference,
      gamesWon: existingStats.gamesWon,
      gamesLost: existingStats.gamesLost,
      gamesDifference: existingStats.gamesDifference,
      position: existingStats.position,
      positionTieInfo: existingStats.positionTieInfo,
      
      // Add new fields for interface compatibility
      customStats: {
        // Store original calculation method for debugging
        calculatedBy: 'ZoneStatsCalculator',
        tournamentType: 'AMERICAN',
        legacyCompatible: true
      },
      tiebreakDetails: []
    }
    
    return extendedStats
  }
  
  /**
   * CRITICAL: Delegate head-to-head to existing calculator
   */
  async createHeadToHeadMatrix(couples: CoupleData[], matches: MatchData[]) {
    // ✅ DELEGATE to existing, optimized code
    return this.existingCalculator.createHeadToHeadMatrix(couples, matches)
  }
  
  /**
   * Override calculateAllCoupleStats for performance
   * Use existing batch calculation instead of individual calls
   */
  async calculateAllCoupleStats(couples: CoupleData[], matches: MatchData[]): Promise<ExtendedCoupleStats[]> {
    // ✅ DELEGATE to existing batch calculation for optimal performance
    const existingResults = this.existingCalculator.calculateAllCoupleStats(couples, matches)
    
    // ✅ CONVERT results to ExtendedCoupleStats format
    return existingResults.map(stats => ({
      coupleId: stats.coupleId,
      player1Name: stats.player1Name,
      player2Name: stats.player2Name,
      player1Score: stats.player1Score,
      player2Score: stats.player2Score,
      totalPlayerScore: stats.totalPlayerScore,
      matchesWon: stats.matchesWon,
      matchesLost: stats.matchesLost,
      matchesPlayed: stats.matchesPlayed,
      setsWon: stats.setsWon,
      setsLost: stats.setsLost,
      setsDifference: stats.setsDifference,
      gamesWon: stats.gamesWon,
      gamesLost: stats.gamesLost,
      gamesDifference: stats.gamesDifference,
      position: stats.position,
      positionTieInfo: stats.positionTieInfo,
      customStats: {
        calculatedBy: 'ZoneStatsCalculator',
        tournamentType: 'AMERICAN',
        legacyCompatible: true
      },
      tiebreakDetails: []
    }))
  }
  
  /**
   * American tournaments support standard statistics
   */
  getSupportedStatistics(): string[] {
    return [
      'wins',
      'losses',
      'games_difference', 
      'games_for',
      'games_against',
      'head_to_head',
      'player_scores',
      'sets_for',        // Always 1 per match won
      'sets_against',    // Always 1 per match lost
      'sets_difference'  // Always = matches won - matches lost
    ]
  }
  
  /**
   * Override processMatch since we delegate everything to existing calculator
   * This method should not be called due to our overridden calculateCoupleStats
   */
  protected async processMatch(): Promise<void> {
    throw new Error('AmericanTournamentStatsProvider delegates to ZoneStatsCalculator - processMatch should not be called')
  }
}