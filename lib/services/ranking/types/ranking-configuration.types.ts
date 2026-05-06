/**
 * RANKING CONFIGURATION TYPES
 * 
 * ⚠️  CRITICAL: These types are NEW and do not affect existing American tournament system
 * ⚠️  BACKWARD COMPATIBILITY: 100% preserved - American tournaments will not use these types
 * 
 * Purpose: Define flexible ranking configurations for extensible tournament formats
 * Decision field: Based on tournament.type from database (tournament_type enum)
 */

export type TournamentType = 'AMERICAN' | 'LONG' | 'AMERICAN_OTP'

export type RankingCriterionType = 
  | 'wins'                    // Matches won
  | 'losses'                  // Matches lost  
  | 'sets_difference'         // Sets won - sets lost
  | 'sets_for'                // Total sets won
  | 'sets_against'            // Total sets lost
  | 'games_difference'        // Games won - games lost
  | 'games_for'               // Total games won  
  | 'games_against'           // Total games lost
  | 'head_to_head'            // Direct confrontation result
  | 'player_scores'           // Sum of player individual scores
  | 'random'                  // Random tiebreaker
  | 'custom'                  // Custom criterion with comparator

export type SortDirection = 'ASC' | 'DESC'

export interface RankingCriterion {
  /** Unique identifier for this criterion */
  name: RankingCriterionType
  
  /** Order in which this criterion is applied (1 = first, 2 = second, etc.) */
  order: number
  
  /** Whether this criterion is enabled */
  enabled: boolean
  
  /** Sort direction - DESC for "higher is better", ASC for "lower is better" */
  direction: SortDirection
  
  /** Weight/importance of this criterion (future use for weighted rankings) */
  weight?: number
  
  /** Custom comparison function for 'custom' criterion type */
  customComparator?: (a: any, b: any) => number
  
  /** Human-readable description of this criterion */
  description?: string
}

export interface RankingConfiguration {
  /** Tournament type this configuration applies to (from tournament.type field) */
  tournamentType: TournamentType
  
  /** Ordered list of ranking criteria */
  criteria: RankingCriterion[]
  
  /** Whether this configuration allows ties in final positions */
  allowTies?: boolean
  
  /** Configuration metadata */
  metadata?: {
    name?: string
    description?: string
    createdAt?: Date
    version?: string
  }
}

export interface TiebreakResult {
  /** Reason why this ranking was determined */
  reason: RankingCriterionType | 'no_tie'
  
  /** Human-readable explanation */
  explanation: string
  
  /** Additional context data */
  context?: Record<string, any>
}

/**
 * Interface for tournament type-specific ranking configurations
 * This allows each tournament type to define its default ranking rules
 */
export interface TournamentTypeRankingProvider {
  /** Get the default ranking configuration for this type */
  getDefaultRankingConfiguration(): RankingConfiguration
  
  /** Check if this type supports configurable ranking */
  supportsConfigurableRanking(): boolean
  
  /** Validate a ranking configuration for this type */
  validateConfiguration(config: RankingConfiguration): { valid: boolean; errors?: string[] }
}

/**
 * Default ranking configurations for each tournament type
 * Based on tournament.type field from database
 */
export const DEFAULT_RANKING_CONFIGURATIONS: Record<TournamentType, RankingConfiguration> = {
  // American tournaments use hardcoded system - this is just for reference
  AMERICAN: {
    tournamentType: 'AMERICAN',
    criteria: [
      { name: 'wins', order: 1, enabled: true, direction: 'DESC', description: 'Matches won' },
      { name: 'head_to_head', order: 2, enabled: true, direction: 'DESC', description: 'Head-to-head result' },
      { name: 'games_difference', order: 3, enabled: true, direction: 'DESC', description: 'Games difference' },
      { name: 'games_for', order: 4, enabled: true, direction: 'DESC', description: 'Games won' },
      { name: 'player_scores', order: 5, enabled: true, direction: 'DESC', description: 'Player scores total' },
      { name: 'random', order: 6, enabled: true, direction: 'DESC', description: 'Random tiebreaker' }
    ],
    metadata: {
      name: 'American Tournament Default',
      description: 'Classic American tournament ranking - hardcoded for performance'
    }
  },
  
  // Long tournament - NEW configurable type
  LONG: {
    tournamentType: 'LONG',
    criteria: [
      { name: 'wins', order: 1, enabled: true, direction: 'DESC', description: 'Matches won' },
      { name: 'sets_difference', order: 2, enabled: true, direction: 'DESC', description: 'Sets difference' },
      { name: 'games_difference', order: 3, enabled: true, direction: 'DESC', description: 'Games difference' },
      { name: 'head_to_head', order: 4, enabled: true, direction: 'DESC', description: 'Head-to-head result' },
      { name: 'sets_for', order: 5, enabled: true, direction: 'DESC', description: 'Sets won' },
      { name: 'games_for', order: 6, enabled: true, direction: 'DESC', description: 'Games won' },
      { name: 'random', order: 7, enabled: true, direction: 'DESC', description: 'Random tiebreaker' }
    ],
    metadata: {
      name: 'Long Tournament Default',
      description: 'Default ranking for long tournaments with 3-set matches'
    }
  },
  
  // American OTP tournament type (single zone American)
  AMERICAN_OTP: {
    tournamentType: 'AMERICAN_OTP',
    criteria: [
      { name: 'wins', order: 1, enabled: true, direction: 'DESC', description: 'Matches won' },
      { name: 'head_to_head', order: 2, enabled: true, direction: 'DESC', description: 'Head-to-head result' },
      { name: 'games_difference', order: 3, enabled: true, direction: 'DESC', description: 'Games difference' },
      { name: 'games_for', order: 4, enabled: true, direction: 'DESC', description: 'Games won' },
      { name: 'player_scores', order: 5, enabled: true, direction: 'DESC', description: 'Player scores total' },
      { name: 'random', order: 6, enabled: true, direction: 'DESC', description: 'Random tiebreaker' }
    ],
    metadata: {
      name: 'American OTP (One Zone) Default',
      description: 'American tournament with single zone configuration'
    }
  }
}