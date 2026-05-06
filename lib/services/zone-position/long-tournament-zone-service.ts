/**
 * LONG TOURNAMENT ZONE SERVICE
 * 
 * ⚠️  CRITICAL: This service is NEW and implements zone position calculation for LONG tournaments
 * ⚠️  ZERO IMPACT: Does not affect existing American tournament system
 * ⚠️  FALLBACK: Automatically falls back to legacy system on any error
 * 
 * Purpose: Calculate and update zone positions for LONG tournaments using configurable ranking
 * Used by: Tournament match result updates, manual recalculations
 */

import { createClient } from '@/utils/supabase/server'
import { ConfigurableRankingService } from '../ranking/services/configurable-ranking.service'
import type { ZoneRankingContext } from '../ranking/interfaces/configurable-ranking.interface'
import type { RankingConfiguration } from '../ranking/types/ranking-configuration.types'

export interface RecalculationResult {
  success: boolean
  updatedCouples: number
  appliedCriteria: string[]
  hasUnresolvedTies: boolean
  calculationTime: number
  error?: string
  fallbackUsed: boolean
}

/**
 * Get ranking configuration for a tournament
 */
async function getRankingConfiguration(tournamentId: string): Promise<RankingConfiguration> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('tournament_ranking_config')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('is_active', true)
    .single()
  
  if (error || !data) {
    // Return default configuration for LONG tournaments
    console.warn(`No ranking config found for tournament ${tournamentId}, using default`)
    return getDefaultLongTournamentConfiguration()
  }
  
  return {
    id: data.id,
    tournamentId: data.tournament_id,
    name: data.name,
    description: data.description,
    criteria: data.criteria,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }
}

/**
 * Get default ranking configuration for LONG tournaments
 */
function getDefaultLongTournamentConfiguration(): RankingConfiguration {
  return {
    id: 'default-long',
    tournamentId: '',
    name: 'Default LONG Tournament Configuration',
    description: 'Default ranking criteria for long tournaments',
    criteria: [
      { order: 1, criterion: 'wins', enabled: true, weight: 1 },
      { order: 2, criterion: 'sets_difference', enabled: true, weight: 1 },
      { order: 3, criterion: 'games_difference', enabled: true, weight: 1 },
      { order: 4, criterion: 'head_to_head', enabled: true, weight: 1 },
      { order: 5, criterion: 'sets_for', enabled: true, weight: 1 },
      { order: 6, criterion: 'games_for', enabled: true, weight: 1 },
      { order: 7, criterion: 'player_scores', enabled: true, weight: 1 }
    ],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

/**
 * Main function: Recalculate zone positions for LONG tournaments
 * This is called whenever a match result is updated
 */
export async function recalculateZonePositions(
  tournamentId: string,
  zoneId: string
): Promise<RecalculationResult> {
  const startTime = Date.now()
  
  try {
    console.log(`🔄 Recalculating zone positions for LONG tournament`)
    console.log(`   Tournament: ${tournamentId}`)
    console.log(`   Zone: ${zoneId}`)
    
    // 1. Verify this is a LONG tournament
    const tournament = await getTournament(tournamentId)
    if (tournament.type !== 'LONG') {
      throw new Error(`recalculateZonePositions called for non-LONG tournament: ${tournament.type}`)
    }
    
    // 2. Get ranking configuration
    const rankingConfiguration = await getRankingConfiguration(tournamentId)
    console.log(`📋 Using configuration: ${rankingConfiguration.name}`)
    console.log(`   Criteria: ${rankingConfiguration.criteria.filter(c => c.enabled).map(c => c.criterion).join(', ')}`)
    
    // 3. Create ranking context
    const context: ZoneRankingContext = {
      tournamentId,
      zoneId,
      tournamentType: 'LONG',
      rankingConfiguration
    }
    
    // 4. Use ConfigurableRankingService to calculate and update positions
    const rankingService = new ConfigurableRankingService()
    const updateResult = await rankingService.updateZonePositionsInDatabase(context)
    
    const calculationTime = Date.now() - startTime
    
    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to update zone positions')
    }
    
    console.log(`✅ Zone positions recalculated successfully`)
    console.log(`   Updated couples: ${updateResult.updatedCouples}`)
    console.log(`   Calculation time: ${calculationTime}ms`)
    console.log(`   Unresolved ties: ${updateResult.hasUnresolvedTies}`)
    
    return {
      success: true,
      updatedCouples: updateResult.updatedCouples,
      appliedCriteria: updateResult.appliedCriteria || [],
      hasUnresolvedTies: updateResult.hasUnresolvedTies || false,
      calculationTime,
      fallbackUsed: false
    }
    
  } catch (error) {
    const calculationTime = Date.now() - startTime
    
    console.error(`❌ Error recalculating zone positions:`, error)
    console.warn(`⚠️  Attempting fallback to legacy system...`)
    
    // Fallback to legacy system (ZonePositionService)
    try {
      const fallbackResult = await attemptLegacyFallback(tournamentId, zoneId)
      
      return {
        success: true,
        updatedCouples: fallbackResult.updatedCouples,
        appliedCriteria: ['legacy_fallback'],
        hasUnresolvedTies: false,
        calculationTime,
        fallbackUsed: true,
        error: `Primary system failed, used legacy fallback: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
      
    } catch (fallbackError) {
      console.error(`❌ Fallback to legacy system also failed:`, fallbackError)
      
      return {
        success: false,
        updatedCouples: 0,
        appliedCriteria: [],
        hasUnresolvedTies: false,
        calculationTime,
        fallbackUsed: true,
        error: `Both primary and fallback systems failed. Primary: ${error instanceof Error ? error.message : 'Unknown'}. Fallback: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown'}`
      }
    }
  }
}

/**
 * Attempt fallback to legacy ZonePositionService
 * This ensures LONG tournaments can still function even if configurable system fails
 */
async function attemptLegacyFallback(
  tournamentId: string,
  zoneId: string
): Promise<{ updatedCouples: number }> {
  // Import legacy service dynamically to avoid circular dependencies
  const { ZonePositionService } = await import('../zone-position/zone-position.service')
  
  console.log(`🔄 Using legacy ZonePositionService as fallback`)
  
  const legacyService = new ZonePositionService()
  const result = await legacyService.updateZonePositionsInDatabase(tournamentId, zoneId)
  
  console.log(`✅ Legacy fallback completed successfully`)
  
  return {
    updatedCouples: result.updatedCouples || 0
  }
}

/**
 * Get tournament information
 */
async function getTournament(tournamentId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('tournaments')
    .select('id, type, name')
    .eq('id', tournamentId)
    .single()
  
  if (error || !data) {
    throw new Error(`Failed to fetch tournament ${tournamentId}: ${error?.message || 'Not found'}`)
  }
  
  return data
}

/**
 * Preview zone positions without updating database
 * Useful for testing configuration changes
 */
export async function previewZonePositions(
  tournamentId: string,
  zoneId: string,
  customConfiguration?: RankingConfiguration
): Promise<{
  success: boolean
  previewResult?: any
  error?: string
}> {
  try {
    console.log(`👀 Previewing zone positions for tournament ${tournamentId}`)
    
    // Get configuration (custom or from database)
    const rankingConfiguration = customConfiguration || await getRankingConfiguration(tournamentId)
    
    // Create context
    const context: ZoneRankingContext = {
      tournamentId,
      zoneId,
      tournamentType: 'LONG',
      rankingConfiguration
    }
    
    // Use service to preview (without database update)
    const rankingService = new ConfigurableRankingService()
    const previewResult = await rankingService.previewRanking(context)
    
    console.log(`✅ Preview completed - ${previewResult.rankedCouples.length} couples ranked`)
    
    return {
      success: true,
      previewResult
    }
    
  } catch (error) {
    console.error(`❌ Error previewing zone positions:`, error)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get current zone positions with detailed stats
 * Useful for displaying current standings
 */
export async function getCurrentZonePositions(zoneId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('zone_positions')
    .select(`
      *,
      couples (
        id,
        players!couples_player1_id_fkey (
          first_name,
          last_name
        ),
        player2:players!couples_player2_id_fkey (
          first_name,
          last_name
        )
      )
    `)
    .eq('zone_id', zoneId)
    .order('position', { ascending: true })
  
  if (error) {
    throw new Error(`Failed to fetch zone positions: ${error.message}`)
  }
  
  return data || []
}