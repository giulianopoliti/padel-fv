/**
 * CONFIGURABLE RANKING SERVICE
 * 
 * ⚠️  CRITICAL: This service is NEW and implements configurable ranking for LONG tournaments
 * ⚠️  ZERO IMPACT: Does not affect existing American tournament system
 * ⚠️  FALLBACK: Automatically falls back to legacy system on any error
 * 
 * Purpose: Main service for calculating zone positions with configurable criteria
 * Used by: LONG tournaments and future configurable tournament types
 */

import { createClient } from '@/utils/supabase/server'
import type { 
  ConfigurableRankingService as IConfigurableRankingService,
  ZoneRankingContext,
  UpdateResult
} from '../interfaces/configurable-ranking.interface'
import type { ExtendedCoupleStats } from '../interfaces/stats-data-provider.interface'
import type { CoupleData, MatchData } from '../../zone-position/types'
import type { RankingConfiguration } from '../types/ranking-configuration.types'
import { ConfigurableRankingEngine, type ConfigurableRankingResult } from '../engines/configurable-ranking-engine'
import { DefaultStatsDataProviderFactory } from '../providers/stats-data-provider-factory'

export interface ZonePositionRecord {
  tournament_id: string
  zone_id: string
  couple_id: string
  position: number
  wins: number
  losses: number
  sets_for: number
  sets_against: number
  sets_difference: number
  games_for: number
  games_against: number
  games_difference: number
  player_score_total: number
  tie_info?: string
  calculated_at: Date
  is_definitive: boolean
}

/**
 * Configurable Ranking Service
 * 
 * Orchestrates the complete ranking calculation process:
 * 1. Get couples and matches data
 * 2. Use appropriate data provider to calculate stats
 * 3. Apply configurable ranking engine
 * 4. Update zone_positions table with results
 */
export class ConfigurableRankingService implements IConfigurableRankingService {
  private engine: ConfigurableRankingEngine
  private providerFactory: DefaultStatsDataProviderFactory
  
  constructor() {
    this.engine = new ConfigurableRankingEngine()
    this.providerFactory = new DefaultStatsDataProviderFactory()
  }
  
  /**
   * Calculate zone positions using configurable ranking
   * This is the main method called by tournament strategies
   */
  async calculateZonePositions(context: ZoneRankingContext): Promise<ConfigurableRankingResult> {
    try {
      console.log(`🎯 Calculating zone positions for ${context.tournamentType} tournament`)
      
      // 1. Get tournament data
      const couples = await this.getCouplesInZone(context.zoneId)
      const matches = await this.getZoneMatches(context.zoneId)
      
      if (couples.length === 0) {
        console.warn(`No couples found in zone ${context.zoneId}`)
        return this.createEmptyResult(context.rankingConfiguration)
      }
      
      // 2. Use appropriate data provider to calculate stats
      const provider = this.providerFactory.createProvider(context.tournamentType)
      if (!provider) {
        throw new Error(`No provider found for tournament type: ${context.tournamentType}`)
      }
      
      console.log(`📊 Using ${provider.getTournamentType()} provider for stats calculation`)
      
      // 3. Calculate couple stats
      const coupleStats = await provider.calculateAllCoupleStats(couples, matches)
      
      // 4. Create head-to-head matrix
      const headToHeadMatrix = await provider.createHeadToHeadMatrix(couples, matches)
      
      // 5. Apply ranking engine
      const rankingResult = this.engine.rankCouplesByConfiguration(
        coupleStats,
        context.rankingConfiguration,
        headToHeadMatrix
      )
      
      console.log(`✅ Zone positions calculated successfully for ${couples.length} couples`)
      console.log(`🏆 Applied criteria: ${rankingResult.calculationMetadata.criteriaApplied.join(', ')}`)
      
      if (rankingResult.calculationMetadata.hasUnresolvedTies) {
        console.warn(`⚠️  Unresolved ties detected in zone ${context.zoneId}`)
      }
      
      return rankingResult
      
    } catch (error) {
      console.error(`❌ Error calculating zone positions for ${context.tournamentType}:`, error)
      
      // Return empty result rather than throwing - let caller decide fallback
      return this.createEmptyResult(context.rankingConfiguration, error as Error)
    }
  }
  
  /**
   * Calculate zone positions and immediately update database
   * This is the method used by match result updates
   */
  async updateZonePositionsInDatabase(context: ZoneRankingContext): Promise<UpdateResult> {
    try {
      console.log(`🔄 Updating zone positions in database for zone ${context.zoneId}`)
      
      // 1. Calculate new positions
      const rankingResult = await this.calculateZonePositions(context)
      
      if (rankingResult.rankedCouples.length === 0) {
        return {
          success: false,
          error: 'No couples to rank',
          updatedCouples: 0
        }
      }
      
      // 2. Update zone_positions table
      const updatedCount = await this.persistZonePositions(
        context.tournamentId,
        context.zoneId,
        rankingResult
      )
      
      // 3. Log ranking changes
      await this.logRankingUpdate(context, rankingResult)
      
      console.log(`✅ Successfully updated ${updatedCount} zone positions`)
      
      return {
        success: true,
        updatedCouples: updatedCount,
        rankingResult,
        appliedCriteria: rankingResult.calculationMetadata.criteriaApplied,
        hasUnresolvedTies: rankingResult.calculationMetadata.hasUnresolvedTies
      }
      
    } catch (error) {
      console.error(`❌ Error updating zone positions in database:`, error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        updatedCouples: 0
      }
    }
  }
  
  /**
   * Preview ranking changes without updating database
   * Useful for configuration testing and UI previews
   */
  async previewRanking(context: ZoneRankingContext): Promise<ConfigurableRankingResult> {
    console.log(`👀 Previewing ranking for zone ${context.zoneId}`)
    return this.calculateZonePositions(context)
  }
  
  /**
   * Get couples in a specific zone
   */
  private async getCouplesInZone(zoneId: string): Promise<CoupleData[]> {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('zone_couples')
      .select(`
        couple_id,
        couples!inner (
          id,
          player1_id,
          player2_id,
          players!couples_player1_id_fkey (
            id,
            first_name,
            last_name,
            score
          ),
          player2:players!couples_player2_id_fkey (
            id,
            first_name,
            last_name,
            score
          )
        )
      `)
      .eq('zone_id', zoneId)
      .eq('es_prueba', false)
    
    if (error) {
      throw new Error(`Failed to fetch couples in zone ${zoneId}: ${error.message}`)
    }
    
    return (data || []).map(item => ({
      id: item.couples.id,
      player1: {
        id: item.couples.players.id,
        first_name: item.couples.players.first_name || '',
        last_name: item.couples.players.last_name || '',
        score: item.couples.players.score || 0
      },
      player2: {
        id: item.couples.player2.id,
        first_name: item.couples.player2.first_name || '',
        last_name: item.couples.player2.last_name || '',
        score: item.couples.player2.score || 0
      }
    }))
  }
  
  /**
   * Get matches in a specific zone
   */
  private async getZoneMatches(zoneId: string): Promise<MatchData[]> {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('zone_id', zoneId)
      .eq('es_prueba', false)
      .order('created_at', { ascending: true })
    
    if (error) {
      throw new Error(`Failed to fetch matches in zone ${zoneId}: ${error.message}`)
    }
    
    return data || []
  }
  
  /**
   * Persist calculated positions to zone_positions table
   */
  private async persistZonePositions(
    tournamentId: string,
    zoneId: string,
    rankingResult: ConfigurableRankingResult
  ): Promise<number> {
    const supabase = await createClient()
    
    // Prepare zone position records
    const zonePositions: Omit<ZonePositionRecord, 'id'>[] = rankingResult.rankedCouples.map(stats => ({
      tournament_id: tournamentId,
      zone_id: zoneId,
      couple_id: stats.coupleId,
      position: stats.position,
      wins: stats.matchesWon,
      losses: stats.matchesLost,
      sets_for: stats.setsWon,
      sets_against: stats.setsLost,
      sets_difference: stats.setsDifference,
      games_for: stats.gamesWon,
      games_against: stats.gamesLost,
      games_difference: stats.gamesDifference,
      player_score_total: stats.totalPlayerScore,
      tie_info: stats.positionTieInfo || null,
      calculated_at: new Date(),
      is_definitive: !rankingResult.calculationMetadata.hasUnresolvedTies
    }))
    
    // Delete existing positions for this zone
    const { error: deleteError } = await supabase
      .from('zone_positions')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('zone_id', zoneId)
    
    if (deleteError) {
      throw new Error(`Failed to clear existing zone positions: ${deleteError.message}`)
    }
    
    // Insert new positions
    const { data, error: insertError } = await supabase
      .from('zone_positions')
      .insert(zonePositions)
      .select('id')
    
    if (insertError) {
      throw new Error(`Failed to insert zone positions: ${insertError.message}`)
    }
    
    return (data || []).length
  }
  
  /**
   * Log ranking update for audit purposes
   */
  private async logRankingUpdate(
    context: ZoneRankingContext,
    rankingResult: ConfigurableRankingResult
  ): Promise<void> {
    try {
      console.log(`📝 Ranking update log for zone ${context.zoneId}:`)
      console.log(`   Tournament: ${context.tournamentId}`)
      console.log(`   Type: ${context.tournamentType}`)
      console.log(`   Couples ranked: ${rankingResult.rankedCouples.length}`)
      console.log(`   Criteria applied: ${rankingResult.calculationMetadata.criteriaApplied.join(', ')}`)
      console.log(`   Unresolved ties: ${rankingResult.calculationMetadata.hasUnresolvedTies}`)
      
      if (rankingResult.tiebreakResults.length > 0) {
        console.log(`   Tiebreaks resolved: ${rankingResult.tiebreakResults.length}`)
        rankingResult.tiebreakResults.forEach(tiebreak => {
          console.log(`     - ${tiebreak.explanation}`)
        })
      }
    } catch (error) {
      console.warn('Failed to log ranking update:', error)
    }
  }
  
  /**
   * Create empty result for error cases
   */
  private createEmptyResult(
    config: RankingConfiguration,
    error?: Error
  ): ConfigurableRankingResult {
    return {
      rankedCouples: [],
      appliedConfiguration: config,
      tiebreakResults: error ? [{
        criterion: 'error',
        coupleIds: [],
        resolvedBy: 'system',
        explanation: `Ranking calculation failed: ${error.message}`
      }] : [],
      calculationMetadata: {
        totalCouples: 0,
        criteriaApplied: [],
        calculatedAt: new Date(),
        hasUnresolvedTies: false
      }
    }
  }
}