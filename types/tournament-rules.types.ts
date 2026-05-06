/**
 * Tournament Rules System
 * 
 * Defines flexible, reusable rules for different tournament formats.
 * Supports multiple tournament types with different zone capacity and advancement rules.
 */

export type AdvancementStrategy = 
  | 'ALL_ADVANCE'    // All couples from zone advance to bracket
  | 'TOP_N'          // Only top N couples advance
  | 'ELIMINATION'    // Bottom N couples are eliminated
  | 'PERCENTAGE';    // Percentage-based advancement

export type ValidationLevel = 'info' | 'warning' | 'error';

export interface ZoneAdvancementRule {
  /** Number of couples that advance to bracket phase */
  qualified: number;
  /** Number of couples that get eliminated */
  eliminated: number;
  /** Strategy used for determining advancement */
  strategy: AdvancementStrategy;
  /** Custom message for this zone size */
  message?: string;
}

export interface ZoneCapacityConfig {
  /** Default/recommended zone size */
  default: number;
  /** Maximum allowed zone size */
  max: number;
  /** Whether to allow zones beyond default size */
  allowOverflow: boolean;
  /** Custom overflow message */
  overflowMessage?: string;
}

export interface TournamentWarningsConfig {
  /** Show warnings when zones exceed default capacity */
  enableOverflowWarnings: boolean;
  /** Show preview of elimination consequences */
  showEliminationPreview: boolean;
  /** Show match count changes for special zones */
  showMatchCountChanges: boolean;
}

export interface TournamentRules {
  /** Zone capacity configuration */
  zoneCapacity: ZoneCapacityConfig;
  
  /** Advancement rules by zone size */
  advancement: Record<number, ZoneAdvancementRule>;
  
  /** Warning and notification settings */
  warnings: TournamentWarningsConfig;
  
  /** Tournament format identifier */
  formatId: string;
  
  /** Human-readable format name */
  formatName: string;
}

export interface ZoneValidationResult {
  /** Whether the action is allowed */
  allowed: boolean;
  
  /** Severity level of the result */
  level: ValidationLevel;
  
  /** Primary message to display */
  message: string;
  
  /** Additional context about consequences */
  consequences?: {
    /** Number of couples that will be eliminated */
    eliminated: number;
    /** Matches per couple in this zone size */
    matchesPerCouple: number;
    /** Total matches in the zone */
    totalMatches: number;
    /** Strategy being applied */
    strategy: AdvancementStrategy;
  };
  
  /** Suggested action for user */
  suggestion?: string;
  
  /** Whether to show a confirmation dialog */
  requiresConfirmation?: boolean;
}

export interface TournamentFormatConfig {
  rules: TournamentRules;
  matches: {
    /** Matches per couple by zone size */
    matchesPerCouple: Record<number, number>;
  };
  display: {
    /** Colors for different zone states */
    colors: {
      normal: string;
      overflow: string;
      full: string;
    };
    /** Icons for different states */
    icons: {
      normal: string;
      warning: string;
      elimination: string;
    };
  };
}

/**
 * Utility type for zone size validation
 */
export type ZoneSizeValidation = {
  isValid: boolean;
  isDefault: boolean;
  isOverflow: boolean;
  isMax: boolean;
};