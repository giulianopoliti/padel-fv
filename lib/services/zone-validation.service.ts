/**
 * Zone Validation Service
 * 
 * Provides intelligent validation for zone operations with contextual feedback.
 * Handles capacity checks, advancement consequences, and user-friendly messaging.
 */

import type {
  ZoneValidationResult,
  TournamentRules,
  ZoneSizeValidation,
  ValidationLevel
} from '@/types/tournament-rules.types';
import { getTournamentFormatConfig, getMatchesPerCouple } from '@/config/tournament-formats.config';

export class ZoneValidationService {
  
  /**
   * Validates adding a couple to a zone
   */
  static validateZoneAddition(
    currentSize: number,
    rules: TournamentRules,
    options: {
      requiresConfirmation?: boolean;
      showDetailedConsequences?: boolean;
    } = {}
  ): ZoneValidationResult {
    const newSize = currentSize + 1;
    
    console.log(`[ZoneValidationService] validateZoneAddition:`, {
      currentSize,
      newSize,
      rules: {
        default: rules.zoneCapacity.default,
        max: rules.zoneCapacity.max
      }
    });
    
    // FIXED: Check if exceeds maximum first (before 3-couple minimum check)
    if (newSize > rules.zoneCapacity.max) {
      return {
        allowed: false,
        level: 'error',
        message: `Máximo ${rules.zoneCapacity.max} parejas por zona`,
        suggestion: 'Crea una nueva zona o redistribuye las parejas'
      };
    }
    
    // Allow building zones (1-2 couples) - they're being constructed
    if (newSize < 3) {
      return {
        allowed: true,
        level: 'info',
        message: `Construyendo zona (${newSize}/3 mínimo)`,
        consequences: this.calculateConsequences(Math.max(newSize, 3), rules) // Use minimum 3 for consequences calculation
      };
    }
    
    // Normal capacity - all good (3-4 couples for AMERICAN_2)
    if (newSize <= rules.zoneCapacity.default) {
      return {
        allowed: true,
        level: 'info',
        message: `Zona estándar (${newSize}/${rules.zoneCapacity.default})`,
        consequences: this.calculateConsequences(newSize, rules)
      };
    }
    
    // Overflow but within limits - show warning (5 couples for AMERICAN_2)
    if (newSize <= rules.zoneCapacity.max) {
      const advancement = rules.advancement[newSize];
      const consequences = this.calculateConsequences(newSize, rules);
      
      return {
        allowed: true,
        level: 'warning',
        message: advancement?.message || `Zona especial: ${consequences.eliminated} pareja quedará eliminada`,
        consequences,
        suggestion: consequences.eliminated > 0 
          ? 'Considera crear una nueva zona si hay suficientes parejas' 
          : undefined,
        requiresConfirmation: options.requiresConfirmation ?? consequences.eliminated > 0
      };
    }
    
    // This should never be reached due to the first check, but kept for safety
    return {
      allowed: false,
      level: 'error',
      message: `Máximo ${rules.zoneCapacity.max} parejas por zona`,
      suggestion: 'Crea una nueva zona o redistribuye las parejas'
    };
  }
  
  /**
   * Validates moving a couple between zones
   */
  static validateZoneMovement(
    fromZoneSize: number,
    toZoneSize: number, 
    rules: TournamentRules,
    coupleHasMatches: boolean = false
  ): {
    fromZoneResult: ZoneValidationResult;
    toZoneResult: ZoneValidationResult;
    movementAllowed: boolean;
  } {
    // Check if couple can be removed from source zone
    const fromZoneResult = this.validateZoneRemoval(fromZoneSize, rules, coupleHasMatches);
    
    // Check if couple can be added to target zone  
    const toZoneResult = this.validateZoneAddition(toZoneSize, rules);
    
    return {
      fromZoneResult,
      toZoneResult,
      movementAllowed: fromZoneResult.allowed && toZoneResult.allowed
    };
  }
  
  /**
   * Validates removing a couple from a zone
   */
  static validateZoneRemoval(
    currentSize: number,
    rules: TournamentRules,
    coupleHasMatches: boolean = false
  ): ZoneValidationResult {
    if (coupleHasMatches) {
      return {
        allowed: false,
        level: 'error', 
        message: 'No se puede mover una pareja que ya jugó partidos',
        suggestion: 'Solo se pueden mover parejas sin partidos jugados'
      };
    }
    
    const newSize = currentSize - 1;
    
    if (newSize < 3) {
      return {
        allowed: false,
        level: 'error',
        message: 'Una zona debe tener al menos 3 parejas',
        suggestion: 'Considera eliminar la zona si quedan menos de 3 parejas'
      };
    }
    
    return {
      allowed: true,
      level: 'info',
      message: `Mover desde zona de ${currentSize} parejas`,
      consequences: this.calculateConsequences(newSize, rules)
    };
  }
  
  /**
   * Validates zone size according to rules
   */
  static validateZoneSize(size: number, rules: TournamentRules): ZoneSizeValidation {
    return {
      isValid: size >= 3 && size <= rules.zoneCapacity.max,
      isDefault: size <= rules.zoneCapacity.default,
      isOverflow: size > rules.zoneCapacity.default && size <= rules.zoneCapacity.max,
      isMax: size === rules.zoneCapacity.max
    };
  }
  
  /**
   * Calculates consequences of a zone with given size
   */
  static calculateConsequences(
    zoneSize: number, 
    rules: TournamentRules
  ): NonNullable<ZoneValidationResult['consequences']> {
    const advancement = rules.advancement[zoneSize];
    const matchesPerCouple = getMatchesPerCouple(rules.formatId, zoneSize);
    
    // Calculate total matches for the zone
    // Formula: (n * matches_per_couple) / 2 (since each match involves 2 couples)
    const totalMatches = (zoneSize * matchesPerCouple) / 2;
    
    return {
      eliminated: advancement?.eliminated || 0,
      matchesPerCouple,
      totalMatches: Math.floor(totalMatches),
      strategy: advancement?.strategy || 'ALL_ADVANCE'
    };
  }
  
  /**
   * Get user-friendly description of zone status
   */
  static getZoneStatusDescription(
    currentSize: number,
    rules: TournamentRules
  ): {
    title: string;
    description: string;
    level: ValidationLevel;
  } {
    const sizeValidation = this.validateZoneSize(currentSize, rules);
    const advancement = rules.advancement[currentSize];
    
    if (sizeValidation.isDefault) {
      return {
        title: 'Zona Estándar',
        description: advancement?.message || 'Todas las parejas clasifican al bracket',
        level: 'info'
      };
    }
    
    if (sizeValidation.isOverflow) {
      return {
        title: 'Zona Especial',
        description: advancement?.message || `${advancement?.eliminated || 0} pareja quedará eliminada`,
        level: 'warning'
      };
    }
    
    return {
      title: 'Zona Inválida',
      description: `Tamaño no permitido (${currentSize})`,
      level: 'error'
    };
  }
  
  /**
   * Get validation for drag and drop operations
   */
  static validateDragDrop(
    dragType: 'couple' | 'zone-couple',
    targetZoneSize: number,
    rules: TournamentRules,
    context: {
      hasPlayedMatches?: boolean;
      isSwapping?: boolean;
    } = {}
  ): ZoneValidationResult {
    if (context.hasPlayedMatches) {
      return {
        allowed: false,
        level: 'error',
        message: 'No se puede mover una pareja que ya jugó',
        suggestion: 'Solo parejas sin partidos pueden moverse'
      };
    }
    
    if (context.isSwapping) {
      // Swapping doesn't change zone sizes, so it's usually allowed
      return {
        allowed: true,
        level: 'info',
        message: 'Intercambiar parejas',
        consequences: this.calculateConsequences(targetZoneSize, rules)
      };
    }
    
    return this.validateZoneAddition(targetZoneSize, rules, {
      requiresConfirmation: true,
      showDetailedConsequences: true
    });
  }
  
  /**
   * Generate suggestions for zone optimization
   */
  static getZoneOptimizationSuggestions(
    zoneSizes: number[],
    rules: TournamentRules
  ): string[] {
    const suggestions: string[] = [];
    const totalCouples = zoneSizes.reduce((sum, size) => sum + size, 0);
    const overflowZones = zoneSizes.filter(size => size > rules.zoneCapacity.default);
    
    if (overflowZones.length > 0) {
      suggestions.push(
        `Tienes ${overflowZones.length} zona(s) con eliminación. ` +
        'Considera redistribuir para evitar eliminar parejas.'
      );
    }
    
    const optimalZones = Math.floor(totalCouples / rules.zoneCapacity.default);
    const remainder = totalCouples % rules.zoneCapacity.default;
    
    if (remainder >= 3 && zoneSizes.length < optimalZones + 1) {
      suggestions.push(
        `Podrías crear ${optimalZones + 1} zonas más equilibradas.`
      );
    }
    
    return suggestions;
  }
}