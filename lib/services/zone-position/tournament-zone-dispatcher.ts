/**
 * TOURNAMENT ZONE DISPATCHER
 * 
 * ⚠️  CRITICAL: This dispatcher routes zone position calculations to the correct system
 * ⚠️  BACKWARD COMPATIBILITY: Ensures American tournaments continue using legacy system
 * ⚠️  NEW FEATURES: Routes LONG tournaments to configurable system
 * 
 * Purpose: Smart dispatcher that chooses the correct zone position calculation system
 * Used by: Match result updates, tournament management actions
 */

import { getRankingSystemType, shouldUseLegacySystem } from '../ranking/utils/ranking-system-decision'
import type { RecalculationResult } from './long-tournament-zone-service'

export interface ZoneUpdateResult {
  success: boolean
  updatedCouples: number
  systemUsed: 'legacy' | 'configurable'
  tournamentType: string
  appliedCriteria: string[]
  hasUnresolvedTies: boolean
  calculationTime: number
  error?: string
  fallbackUsed?: boolean
}

/**
 * Main dispatcher function: Update zone positions using the appropriate system
 * This is the single entry point that should be used by all tournament updates
 */
export async function updateZonePositionsForTournament(
  tournamentId: string,
  zoneId: string
): Promise<ZoneUpdateResult> {
  const startTime = Date.now()
  
  try {
    // 1. Get tournament information to determine system type
    const tournament = await getTournamentInfo(tournamentId)
    const systemType = getRankingSystemType(tournament.type)
    
    console.log(`🎯 Updating zone positions for ${tournament.type} tournament`)
    console.log(`   Tournament: ${tournament.name || tournament.id}`)
    console.log(`   Zone: ${zoneId}`)
    console.log(`   System: ${systemType}`)
    
    let result: ZoneUpdateResult
    
    if (shouldUseLegacySystem(tournament.type)) {
      // Use existing American tournament system
      result = await updateWithLegacySystem(tournamentId, zoneId, tournament)
    } else {
      // Use new configurable system
      result = await updateWithConfigurableSystem(tournamentId, zoneId, tournament)
    }
    
    const totalTime = Date.now() - startTime
    result.calculationTime = totalTime
    
    console.log(`✅ Zone position update completed`)
    console.log(`   System used: ${result.systemUsed}`)
    console.log(`   Updated couples: ${result.updatedCouples}`)
    console.log(`   Total time: ${totalTime}ms`)
    
    if (result.fallbackUsed) {
      console.warn(`⚠️  Fallback system was used due to primary system failure`)
    }
    
    return result
    
  } catch (error) {
    const totalTime = Date.now() - startTime
    
    console.error(`❌ Critical error in zone position update:`, error)
    
    return {
      success: false,
      updatedCouples: 0,
      systemUsed: 'legacy', // Default assumption
      tournamentType: 'UNKNOWN',
      appliedCriteria: [],
      hasUnresolvedTies: false,
      calculationTime: totalTime,
      error: error instanceof Error ? error.message : 'Unknown critical error'
    }
  }
}

/**
 * Update using legacy system (American tournaments)
 */
async function updateWithLegacySystem(
  tournamentId: string,
  zoneId: string,
  tournament: TournamentInfo
): Promise<ZoneUpdateResult> {
  console.log(`🏛️  Using legacy ZonePositionService for ${tournament.type} tournament`)
  
  // Import legacy service dynamically
  const { ZonePositionService } = await import('./zone-position.service')
  
  const legacyService = new ZonePositionService()
  const result = await legacyService.updateZonePositionsInDatabase(tournamentId, zoneId)
  
  return {
    success: true,
    updatedCouples: result.updatedCouples || 0,
    systemUsed: 'legacy',
    tournamentType: tournament.type,
    appliedCriteria: ['hardcoded_american_criteria'], // Legacy system uses hardcoded criteria
    hasUnresolvedTies: false, // Legacy system doesn't track this
    calculationTime: 0, // Will be set by caller
    fallbackUsed: false
  }
}

/**
 * Update using configurable system (LONG tournaments)
 */
async function updateWithConfigurableSystem(
  tournamentId: string,
  zoneId: string,
  tournament: TournamentInfo
): Promise<ZoneUpdateResult> {
  console.log(`⚙️  Using ConfigurableRankingService for ${tournament.type} tournament`)
  
  // Import configurable service
  const { recalculateZonePositions } = await import('./long-tournament-zone-service')
  
  const result: RecalculationResult = await recalculateZonePositions(tournamentId, zoneId)
  
  return {
    success: result.success,
    updatedCouples: result.updatedCouples,
    systemUsed: result.fallbackUsed ? 'legacy' : 'configurable',
    tournamentType: tournament.type,
    appliedCriteria: result.appliedCriteria,
    hasUnresolvedTies: result.hasUnresolvedTies,
    calculationTime: result.calculationTime,
    error: result.error,
    fallbackUsed: result.fallbackUsed
  }
}

/**
 * Get tournament information for system routing
 */
interface TournamentInfo {
  id: string
  type: string
  name?: string
}

async function getTournamentInfo(tournamentId: string): Promise<TournamentInfo> {
  const { createClient } = await import('@/utils/supabase/server')
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('tournaments')
    .select('id, type, name')
    .eq('id', tournamentId)
    .single()
  
  if (error || !data) {
    throw new Error(`Failed to fetch tournament info: ${error?.message || 'Tournament not found'}`)
  }
  
  return {
    id: data.id,
    type: data.type,
    name: data.name
  }
}

/**
 * Preview zone positions for any tournament type
 * Routes to appropriate preview system
 */
export async function previewZonePositionsForTournament(
  tournamentId: string,
  zoneId: string,
  customConfiguration?: any
): Promise<{
  success: boolean
  previewResult?: any
  systemUsed: 'legacy' | 'configurable'
  tournamentType: string
  error?: string
}> {
  try {
    const tournament = await getTournamentInfo(tournamentId)
    const systemType = getRankingSystemType(tournament.type)
    
    console.log(`👀 Previewing zone positions for ${tournament.type} tournament`)
    
    if (shouldUseLegacySystem(tournament.type)) {
      // Legacy system doesn't support preview, just return current positions
      const { getCurrentZonePositions } = await import('./long-tournament-zone-service')
      const currentPositions = await getCurrentZonePositions(zoneId)
      
      return {
        success: true,
        previewResult: {
          rankedCouples: currentPositions,
          note: 'Legacy system - showing current positions (preview not supported)'
        },
        systemUsed: 'legacy',
        tournamentType: tournament.type
      }
      
    } else {
      // Use configurable system preview
      const { previewZonePositions } = await import('./long-tournament-zone-service')
      const result = await previewZonePositions(tournamentId, zoneId, customConfiguration)
      
      return {
        success: result.success,
        previewResult: result.previewResult,
        systemUsed: 'configurable',
        tournamentType: tournament.type,
        error: result.error
      }
    }
    
  } catch (error) {
    return {
      success: false,
      systemUsed: 'legacy',
      tournamentType: 'UNKNOWN',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get current zone positions for any tournament type
 * Routes to appropriate data retrieval system
 */
export async function getCurrentZonePositionsForTournament(
  tournamentId: string,
  zoneId: string
): Promise<{
  success: boolean
  positions?: any[]
  systemUsed: 'legacy' | 'configurable'
  tournamentType: string
  error?: string
}> {
  try {
    const tournament = await getTournamentInfo(tournamentId)
    const systemType = getRankingSystemType(tournament.type)
    
    // Both systems can use the same zone_positions table query
    const { getCurrentZonePositions } = await import('./long-tournament-zone-service')
    const positions = await getCurrentZonePositions(zoneId)
    
    return {
      success: true,
      positions,
      systemUsed: shouldUseLegacySystem(tournament.type) ? 'legacy' : 'configurable',
      tournamentType: tournament.type
    }
    
  } catch (error) {
    return {
      success: false,
      systemUsed: 'legacy',
      tournamentType: 'UNKNOWN',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}