/**
 * Tournament Configuration Service
 * 
 * Central service for managing tournament configurations and rules.
 * Provides type-safe access to tournament format configurations.
 */

import type { 
  TournamentRules, 
  TournamentFormatConfig,
  ZoneAdvancementRule 
} from '@/types/tournament-rules.types';
import { 
  getTournamentFormatConfig,
  getAvailableTournamentFormats,
  formatSupportsOverflow,
  getMatchesPerCouple,
  DEFAULT_TOURNAMENT_CONFIG 
} from '@/config/tournament-formats.config';

export class TournamentConfigService {
  
  /**
   * Get tournament rules by format ID
   */
  static getRulesForFormat(formatId: string): TournamentRules {
    const config = getTournamentFormatConfig(formatId);
    return config.rules;
  }
  
  /**
   * Get complete tournament configuration by format ID
   */
  static getConfigForFormat(formatId: string): TournamentFormatConfig {
    return getTournamentFormatConfig(formatId);
  }
  
  /**
   * Get tournament rules from tournament data
   */
  static async getRulesForTournament(tournamentId: string): Promise<TournamentRules> {
    try {
      // For now, we'll detect format from tournament data
      // Later this can be enhanced to read from database
      const format = await this.detectTournamentFormat(tournamentId);
      return this.getRulesForFormat(format);
    } catch (error) {
      console.warn('[TournamentConfigService] Failed to detect tournament format, using default:', error);
      return DEFAULT_TOURNAMENT_CONFIG.rules;
    }
  }
  
  /**
   * Get advancement strategy for a zone size
   */
  static getAdvancementStrategy(
    zoneSize: number, 
    rules: TournamentRules
  ): ZoneAdvancementRule {
    // Return the specific rule for this zone size, or fallback to default 4-couple rule
    return rules.advancement[zoneSize] || rules.advancement[4] || {
      qualified: zoneSize, 
      eliminated: 0, 
      strategy: 'ALL_ADVANCE'
    };
  }
  
  /**
   * Check if a tournament format allows zone overflow
   */
  static allowsZoneOverflow(formatId: string): boolean {
    return formatSupportsOverflow(formatId);
  }
  
  /**
   * Get matches per couple for a zone size
   */
  static getMatchesPerCouple(formatId: string, zoneSize: number): number {
    return getMatchesPerCouple(formatId, zoneSize);
  }
  
  /**
   * Get all available tournament formats
   */
  static getAvailableFormats(): Array<{ id: string; name: string; rules: TournamentRules }> {
    return getAvailableTournamentFormats();
  }
  
  /**
   * Detect tournament format from tournament data
   * This is a placeholder - in a real implementation, this would query the database
   */
  private static async detectTournamentFormat(tournamentId: string): Promise<string> {
    // TODO: Implement actual format detection from database
    // For now, return default format
    
    // Example logic:
    // const tournament = await getTournamentById(tournamentId);
    // return tournament.format_type || 'AMERICAN_2';
    
    return 'AMERICAN_2';
  }
  
  /**
   * Validate tournament configuration
   */
  static validateTournamentConfig(config: TournamentFormatConfig): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // Validate zone capacity
    if (config.rules.zoneCapacity.default < 3) {
      errors.push('Default zone capacity must be at least 3');
    }
    
    if (config.rules.zoneCapacity.max < config.rules.zoneCapacity.default) {
      errors.push('Maximum zone capacity must be >= default capacity');
    }
    
    // Validate advancement rules
    Object.entries(config.rules.advancement).forEach(([sizeStr, rule]) => {
      const size = parseInt(sizeStr);
      
      if (rule.qualified + rule.eliminated !== size) {
        errors.push(`Zone size ${size}: qualified + eliminated must equal zone size`);
      }
      
      if (rule.qualified < 0 || rule.eliminated < 0) {
        errors.push(`Zone size ${size}: qualified and eliminated must be non-negative`);
      }
    });
    
    // Validate matches configuration
    Object.entries(config.matches.matchesPerCouple).forEach(([sizeStr, matches]) => {
      const size = parseInt(sizeStr);
      
      if (matches < 1) {
        errors.push(`Zone size ${size}: matches per couple must be at least 1`);
      }
      
      // Validate that matches make sense for zone size
      const maxPossibleMatches = size - 1; // Round robin maximum
      if (matches > maxPossibleMatches) {
        errors.push(`Zone size ${size}: matches per couple (${matches}) exceeds maximum possible (${maxPossibleMatches})`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Get display configuration for a tournament format
   */
  static getDisplayConfig(formatId: string): TournamentFormatConfig['display'] {
    const config = getTournamentFormatConfig(formatId);
    return config.display;
  }
  
  /**
   * Calculate optimal zone distribution for a number of couples
   */
  static calculateOptimalZoneDistribution(
    totalCouples: number,
    formatId: string
  ): {
    zones: number[];
    totalZones: number;
    eliminatedCouples: number;
    suggestions: string[];
  } {
    const rules = this.getRulesForFormat(formatId);
    const defaultSize = rules.zoneCapacity.default;
    const maxSize = rules.zoneCapacity.max;
    
    // Try to create zones of default size
    const baseZones = Math.floor(totalCouples / defaultSize);
    const remainder = totalCouples % defaultSize;
    
    let zones: number[] = new Array(baseZones).fill(defaultSize);
    let eliminatedCouples = 0;
    const suggestions: string[] = [];
    
    if (remainder > 0) {
      if (remainder >= 3) {
        // Create new zone with remainder
        zones.push(remainder);
      } else if (zones.length > 0 && zones[zones.length - 1] + remainder <= maxSize) {
        // Add remainder to last zone if possible
        zones[zones.length - 1] += remainder;
      } else {
        // Distribute remainder among existing zones
        for (let i = 0; i < remainder && i < zones.length; i++) {
          if (zones[i] < maxSize) {
            zones[i]++;
          }
        }
      }
    }
    
    // Calculate eliminated couples
    zones.forEach(zoneSize => {
      const advancement = this.getAdvancementStrategy(zoneSize, rules);
      eliminatedCouples += advancement.eliminated;
    });
    
    // Generate suggestions
    if (eliminatedCouples > 0) {
      suggestions.push(`${eliminatedCouples} pareja(s) serán eliminadas en fase de zonas`);
    }
    
    if (zones.some(size => size > defaultSize)) {
      suggestions.push('Considera redistribuir para equilibrar las zonas');
    }
    
    return {
      zones,
      totalZones: zones.length,
      eliminatedCouples,
      suggestions
    };
  }
  
  /**
   * Create custom tournament rules (for advanced users)
   */
  static createCustomRules(
    baseFormatId: string,
    overrides: Partial<TournamentRules>
  ): TournamentRules {
    const baseRules = this.getRulesForFormat(baseFormatId);
    
    return {
      ...baseRules,
      ...overrides,
      // Ensure nested objects are properly merged
      zoneCapacity: {
        ...baseRules.zoneCapacity,
        ...overrides.zoneCapacity
      },
      advancement: {
        ...baseRules.advancement,
        ...overrides.advancement
      },
      warnings: {
        ...baseRules.warnings,
        ...overrides.warnings
      }
    };
  }
}