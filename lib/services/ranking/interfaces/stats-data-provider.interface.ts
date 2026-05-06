/**
 * STATS DATA PROVIDER INTERFACE
 * 
 * ⚠️  CRITICAL: This interface is NEW and does not affect existing American tournament system
 * ⚠️  BACKWARD COMPATIBILITY: 100% preserved - American tournaments will continue using existing ZoneStatsCalculator
 * 
 * Purpose: Pluggable data providers for different tournament formats
 * - American: Uses result_couple1/2 from matches table
 * - Long: Uses set_matches table for detailed set/game tracking  
 * - Future formats: Can implement any data structure
 */

// Re-export existing types for compatibility
import type { CoupleData, MatchData, CoupleStats, HeadToHeadResult } from '../../zone-position/types'

/**
 * Set-level match data for tournaments with multiple sets per match
 */
export interface SetData {
  id: string
  match_id: string
  set_number: number
  couple1_games: number
  couple2_games: number
  winner_couple_id: string | null
  status: string
  duration_minutes?: number
  notes?: string
}

/**
 * Game-level data for future detailed tracking
 */
export interface GameData {
  id: string
  set_id: string
  game_number: number
  couple1_points: number
  couple2_points: number
  winner_couple_id: string | null
}

/**
 * Extended couple stats for configurable ranking systems
 * Maintains compatibility with existing CoupleStats but adds extensibility
 */
export interface ExtendedCoupleStats extends CoupleStats {
  /** Additional stats for future formats */
  customStats?: Record<string, number>
  
  /** Detailed tiebreak information */
  tiebreakDetails?: {
    criterion: string
    value: any
    comparison?: string
  }[]
}

/**
 * Provider for tournament statistics data
 * Different tournament types implement this interface to provide stats calculation
 * 
 * ⚠️  IMPORTANT: American tournaments will NOT use this interface
 * They will continue using the existing ZoneStatsCalculator directly
 */
export interface StatsDataProvider {
  /**
   * Get the tournament type this provider handles (from tournament.type field)
   */
  getTournamentType(): string
  
  /**
   * Calculate statistics for a single couple
   * @param couple - Couple data
   * @param matches - All matches for this couple's zone
   * @returns Promise of calculated statistics
   */
  calculateCoupleStats(couple: CoupleData, matches: MatchData[]): Promise<ExtendedCoupleStats>
  
  /**
   * Calculate statistics for all couples in a zone
   * @param couples - All couples in the zone
   * @param matches - All matches in the zone
   * @returns Promise of array of calculated statistics
   */
  calculateAllCoupleStats(couples: CoupleData[], matches: MatchData[]): Promise<ExtendedCoupleStats[]>
  
  /**
   * Create head-to-head matrix for couples
   * @param couples - All couples in the zone
   * @param matches - All matches in the zone  
   * @returns Promise of head-to-head results matrix
   */
  createHeadToHeadMatrix(couples: CoupleData[], matches: MatchData[]): Promise<HeadToHeadResult[]>
  
  /**
   * Get detailed set data for a match (for multi-set tournaments)
   * @param matchId - Match ID
   * @returns Promise of set data array
   */
  getSetData?(matchId: string): Promise<SetData[]>
  
  /**
   * Get detailed game data for a set (for future detailed tracking)
   * @param setId - Set ID
   * @returns Promise of game data array
   */
  getGameData?(setId: string): Promise<GameData[]>
  
  /**
   * Check if this provider supports a specific statistic
   * @param statName - Name of the statistic
   * @returns Whether this provider can calculate this statistic
   */
  supportsStatistic(statName: string): boolean
  
  /**
   * Get all statistics this provider can calculate
   * @returns Array of statistic names
   */
  getSupportedStatistics(): string[]
}

/**
 * Factory for creating appropriate data providers
 * This will be used by the configurable ranking system
 */
export interface StatsDataProviderFactory {
  /**
   * Create a data provider for the specified tournament type
   * @param type - Tournament type (from tournament.type field)
   * @returns Data provider instance or null if type doesn't need configurable ranking
   */
  createProvider(type: string): StatsDataProvider | null
  
  /**
   * Check if a tournament type supports configurable ranking
   * @param type - Tournament type (from tournament.type field)
   * @returns True if type uses configurable ranking, false if it uses legacy system
   */
  supportsConfigurableRanking(type: string): boolean
  
  /**
   * Register a new data provider for a tournament type
   * @param type - Tournament type (from tournament.type field)
   * @param provider - Data provider instance
   */
  registerProvider(type: string, provider: StatsDataProvider): void
}

/**
 * Base abstract class for stats data providers
 * Provides common functionality that most providers will need
 */
export abstract class BaseStatsDataProvider implements StatsDataProvider {
  protected abstract type: string
  
  getTournamentType(): string {
    return this.type
  }
  
  abstract calculateCoupleStats(couple: CoupleData, matches: MatchData[]): Promise<ExtendedCoupleStats>
  
  async calculateAllCoupleStats(couples: CoupleData[], matches: MatchData[]): Promise<ExtendedCoupleStats[]> {
    const results: ExtendedCoupleStats[] = []
    
    for (const couple of couples) {
      const stats = await this.calculateCoupleStats(couple, matches)
      results.push(stats)
    }
    
    return results
  }
  
  abstract createHeadToHeadMatrix(couples: CoupleData[], matches: MatchData[]): Promise<HeadToHeadResult[]>
  
  supportsStatistic(statName: string): boolean {
    return this.getSupportedStatistics().includes(statName)
  }
  
  abstract getSupportedStatistics(): string[]
}