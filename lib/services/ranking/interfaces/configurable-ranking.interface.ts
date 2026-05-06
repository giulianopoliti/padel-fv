/**
 * CONFIGURABLE RANKING SERVICE INTERFACE
 * 
 * ⚠️  CRITICAL: This interface is NEW and does not affect existing American tournament system
 * ⚠️  BACKWARD COMPATIBILITY: 100% preserved - American tournaments continue using ZonePositionService directly
 * 
 * Purpose: Define contracts for configurable ranking systems that can be plugged into different tournament formats
 */

import type { CoupleData, MatchData } from '../../zone-position/types'
import type { RankingConfiguration } from '../types/ranking-configuration.types'
import type { ExtendedCoupleStats, StatsDataProvider } from './stats-data-provider.interface'

/**
 * Configuration for a single zone ranking calculation
 */
export interface ZoneRankingContext {
  /** Tournament ID */
  tournamentId: string
  
  /** Zone ID being ranked */
  zoneId: string
  
  /** Tournament type (from tournament.type field) */
  tournamentType: string
  
  /** Ranking configuration to use */
  rankingConfiguration: RankingConfiguration
  
  /** Data provider for statistics */
  dataProvider: StatsDataProvider
  
  /** Additional context data */
  metadata?: Record<string, any>
}

/**
 * Result of a configurable ranking operation
 */
export interface ConfigurableRankingResult {
  /** Ranked couples with calculated positions */
  rankedCouples: ExtendedCoupleStats[]
  
  /** Applied ranking configuration */
  appliedConfiguration: RankingConfiguration
  
  /** Detailed tiebreak information */
  tiebreakResults: any[]
  
  /** Performance metrics */
  performanceMetrics?: {
    calculationTimeMs: number
    dataFetchTimeMs: number
    coupleCount: number
    matchCount: number
  }
  
  /** Whether fallback to legacy system was used */
  usedLegacyFallback: boolean
}

/**
 * Result of updating zone positions in database
 */
export interface UpdateResult {
  success: boolean
  error?: string
  updatedCouples: number
  rankingResult?: ConfigurableRankingResult
  appliedCriteria?: string[]
  hasUnresolvedTies?: boolean
}

/**
 * Main interface for configurable ranking services
 * This provides the contract for ranking systems that can adapt to different tournament formats
 * 
 * ⚠️  IMPORTANT: American tournaments will NOT use implementations of this interface
 * They will continue using ZonePositionService with hardcoded ZoneRankingEngine
 */
export interface ConfigurableRankingService {
  /**
   * Calculate zone positions using configurable ranking
   * @param context - Ranking context with configuration and data provider
   * @returns Promise of ranking result with detailed information
   */
  calculateZonePositions(context: ZoneRankingContext): Promise<ConfigurableRankingResult>
  
  /**
   * Update zone positions in database using configurable ranking
   * @param context - Ranking context
   * @returns Promise of update result
   */
  updateZonePositionsInDatabase(context: ZoneRankingContext): Promise<UpdateResult>
  
  /**
   * Validate a ranking configuration
   * @param config - Configuration to validate
   * @returns Validation result
   */
  validateConfiguration(config: RankingConfiguration): {
    valid: boolean
    errors?: string[]
    warnings?: string[]
  }
  
  /**
   * Preview ranking results without saving to database
   * @param context - Ranking context
   * @returns Promise of preview result
   */
  previewRanking(context: ZoneRankingContext): Promise<ConfigurableRankingResult>
  
  /**
   * Check if this service supports a specific tournament type
   * @param type - Tournament type to check (from tournament.type field)
   * @returns True if supported, false otherwise
   */
  supportsType(type: string): boolean
  
  /**
   * Get supported tournament types
   * @returns Array of supported type names
   */
  getSupportedTypes(): string[]
}

/**
 * Factory for creating configurable ranking services
 */
export interface ConfigurableRankingServiceFactory {
  /**
   * Create a ranking service for a specific tournament type
   * @param type - Tournament type (from tournament.type field)
   * @param configuration - Optional custom configuration
   * @returns Ranking service instance or null if type should use legacy system
   */
  createService(
    type: string, 
    configuration?: RankingConfiguration
  ): ConfigurableRankingService | null
  
  /**
   * Check if a tournament type should use configurable ranking
   * @param type - Tournament type (from tournament.type field)
   * @returns True if type should use configurable ranking, false for legacy system
   */
  shouldUseConfigurableRanking(type: string): boolean
  
  /**
   * Register a ranking service for a tournament type
   * @param type - Tournament type (from tournament.type field)
   * @param serviceFactory - Factory function to create service instances
   */
  registerService(
    type: string, 
    serviceFactory: (config?: RankingConfiguration) => ConfigurableRankingService
  ): void
}

/**
 * Integration interface for connecting configurable ranking to existing zone position system
 * This allows seamless fallback to legacy systems when needed
 */
export interface RankingSystemIntegration {
  /**
   * Determine which ranking system to use for a tournament
   * @param tournamentId - Tournament ID
   * @param type - Tournament type (from tournament.type field)
   * @returns Promise of system choice
   */
  determineRankingSystem(tournamentId: string, type: string): Promise<{
    useConfigurable: boolean
    configuration?: RankingConfiguration
    reason: string
  }>
  
  /**
   * Migrate from legacy system to configurable system
   * @param tournamentId - Tournament ID
   * @param targetConfiguration - Target ranking configuration
   * @returns Promise of migration result
   */
  migrateToConfigurableSystem?(
    tournamentId: string, 
    targetConfiguration: RankingConfiguration
  ): Promise<{
    success: boolean
    backupCreated: boolean
    error?: string
  }>
  
  /**
   * Fallback to legacy system if configurable system fails
   * @param tournamentId - Tournament ID
   * @param zoneId - Zone ID
   * @param error - Error that caused fallback
   * @returns Promise of legacy system result
   */
  fallbackToLegacySystem(
    tournamentId: string, 
    zoneId: string, 
    error: Error
  ): Promise<{
    success: boolean
    error?: string
    updatedCouples: number
  }>
}