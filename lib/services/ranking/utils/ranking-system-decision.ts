/**
 * RANKING SYSTEM DECISION LOGIC
 * 
 * ⚠️  CRITICAL: This logic ensures ZERO impact on existing American tournament system
 * Decision is based on tournament.type field from database
 * 
 * Purpose: Determine which ranking system to use based on tournament type
 */

import type { TournamentType } from '../types/ranking-configuration.types'
import { isLegacyTournamentType, isConfigurableTournamentType } from '../interfaces'

export type RankingSystemType = 'LEGACY' | 'CONFIGURABLE'

/**
 * Main decision function - determines which ranking system to use
 * Based on tournament.type field from database
 */
export function getRankingSystemType(tournamentType: string): RankingSystemType {
  // ✅ CRITICAL: American tournaments ALWAYS use legacy system
  if (isLegacyTournamentType(tournamentType)) {
    return 'LEGACY'
  }
  
  // 🆕 New tournament types use configurable system
  if (isConfigurableTournamentType(tournamentType)) {
    return 'CONFIGURABLE'
  }
  
  // 🚨 Unknown tournament type - log warning and default to legacy for safety
  console.warn(`Unknown tournament type: ${tournamentType}. Defaulting to LEGACY system for safety.`)
  return 'LEGACY'
}

/**
 * Check if a tournament type should use the existing ZonePositionService
 */
export function shouldUseLegacySystem(tournamentType: string): boolean {
  return getRankingSystemType(tournamentType) === 'LEGACY'
}

/**
 * Check if a tournament type should use the new ConfigurableRankingService
 */
export function shouldUseConfigurableSystem(tournamentType: string): boolean {
  return getRankingSystemType(tournamentType) === 'CONFIGURABLE'
}

/**
 * Get human-readable system name
 */
export function getRankingSystemName(tournamentType: string): string {
  switch (getRankingSystemType(tournamentType)) {
    case 'LEGACY':
      return 'Sistema Clásico (Hardcoded)'
    case 'CONFIGURABLE':
      return 'Sistema Configurable'
    default:
      return 'Sistema Desconocido'
  }
}

/**
 * Tournament type mapping for system decision
 */
export const TOURNAMENT_TYPE_SYSTEM_MAP: Record<TournamentType, RankingSystemType> = {
  // Legacy systems (existing code)
  'AMERICAN': 'LEGACY',          // ✅ Multi-zone American - uses existing ZoneRankingEngine
  
  // Configurable systems (new code)
  'LONG': 'CONFIGURABLE',        // 🆕 3-set matches with configurable ranking
  'AMERICAN_OTP': 'CONFIGURABLE' // 🆕 Single-zone American with configurable ranking
}

/**
 * Get supported tournament types for each system
 */
export function getLegacySupportedTypes(): LegacyTournamentType[] {
  return Object.entries(TOURNAMENT_TYPE_SYSTEM_MAP)
    .filter(([_, system]) => system === 'LEGACY')
    .map(([type, _]) => type as LegacyTournamentType)
}

export function getConfigurableSupportedTypes(): ConfigurableTournamentType[] {
  return Object.entries(TOURNAMENT_TYPE_SYSTEM_MAP)
    .filter(([_, system]) => system === 'CONFIGURABLE')
    .map(([type, _]) => type as ConfigurableTournamentType)
}

/**
 * Validate tournament type exists in our system
 */
export function isValidTournamentType(type: string): type is TournamentType {
  return Object.keys(TOURNAMENT_TYPE_SYSTEM_MAP).includes(type)
}

/**
 * Migration utility - check if a tournament type can be safely migrated
 */
export function canMigrateToConfigurableSystem(currentType: string, targetType: string): {
  canMigrate: boolean
  reason: string
} {
  if (!isValidTournamentType(currentType) || !isValidTournamentType(targetType)) {
    return {
      canMigrate: false,
      reason: 'Invalid tournament type provided'
    }
  }
  
  const currentSystem = getRankingSystemType(currentType)
  const targetSystem = getRankingSystemType(targetType)
  
  if (currentSystem === targetSystem) {
    return {
      canMigrate: false,
      reason: 'Source and target use the same ranking system'
    }
  }
  
  if (currentSystem === 'LEGACY' && targetSystem === 'CONFIGURABLE') {
    return {
      canMigrate: true,
      reason: 'Migration from legacy to configurable system is supported'
    }
  }
  
  if (currentSystem === 'CONFIGURABLE' && targetSystem === 'LEGACY') {
    return {
      canMigrate: false,
      reason: 'Migration from configurable to legacy system is not recommended (data loss)'
    }
  }
  
  return {
    canMigrate: false,
    reason: 'Unknown migration path'
  }
}

// Re-export types for convenience
export type { TournamentType, ConfigurableTournamentType, LegacyTournamentType } from '../interfaces'