/**
 * RANKING INTERFACES INDEX
 * 
 * ⚠️  CRITICAL: These interfaces are NEW and do not affect existing American tournament system
 * ⚠️  BACKWARD COMPATIBILITY: 100% preserved - existing code continues to work unchanged
 * 
 * This module provides interfaces for extensible tournament ranking systems.
 * American tournaments continue using their existing hardcoded system for optimal performance.
 */

// Configuration types
export * from '../types/ranking-configuration.types'

// Core interfaces  
export * from './stats-data-provider.interface'
export * from './configurable-ranking.interface'

// Re-export zone-position types for compatibility
export type {
  CoupleData,
  MatchData,
  CoupleStats,
  HeadToHeadResult,
  ZonePositionResult,
  TiebreakReason
} from '../../zone-position/types'

/**
 * Utility type to check if a tournament type uses configurable ranking
 * Based on tournament.type field from database
 */
export type ConfigurableTournamentType = 'LONG' | 'AMERICAN_OTP'
export type LegacyTournamentType = 'AMERICAN'

/**
 * Type guard to check if a tournament type uses configurable ranking
 */
export function isConfigurableTournamentType(type: string): type is ConfigurableTournamentType {
  return ['LONG', 'AMERICAN_OTP'].includes(type)
}

/**
 * Type guard to check if a tournament type uses legacy hardcoded ranking
 */  
export function isLegacyTournamentType(type: string): type is LegacyTournamentType {
  return ['AMERICAN'].includes(type)
}

/**
 * Constants for ranking system identification
 */
export const RANKING_SYSTEM = {
  LEGACY: 'legacy',
  CONFIGURABLE: 'configurable'
} as const

export type RankingSystemType = typeof RANKING_SYSTEM[keyof typeof RANKING_SYSTEM]