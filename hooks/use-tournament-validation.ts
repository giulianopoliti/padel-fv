/**
 * Tournament Validation Hook
 * 
 * React hook for tournament rule validation with caching and reactive updates.
 * Provides easy access to validation results and zone configuration.
 */

import { useMemo, useCallback } from 'react';
import type { 
  TournamentRules, 
  ZoneValidationResult,
  TournamentFormatConfig 
} from '@/types/tournament-rules.types';
import { ZoneValidationService } from '@/lib/services/zone-validation.service';
import { TournamentConfigService } from '@/lib/services/tournament-config.service';

interface UseTournamentValidationOptions {
  tournamentId?: string;
  formatId?: string;
  enableCaching?: boolean;
}

interface ZoneValidationHookResult {
  // Configuration
  rules: TournamentRules;
  config: TournamentFormatConfig;
  
  // Validation functions
  validateZoneAddition: (currentSize: number, options?: any) => ZoneValidationResult;
  validateZoneMovement: (fromSize: number, toSize: number, hasMatches?: boolean) => ReturnType<typeof ZoneValidationService.validateZoneMovement>;
  validateZoneRemoval: (currentSize: number, hasMatches?: boolean) => ZoneValidationResult;
  validateDragDrop: (dragType: 'couple' | 'zone-couple', targetSize: number, context?: any) => ZoneValidationResult;
  
  // Utility functions
  getZoneStatusDescription: (currentSize: number) => ReturnType<typeof ZoneValidationService.getZoneStatusDescription>;
  getAdvancementStrategy: (zoneSize: number) => ReturnType<typeof TournamentConfigService.getAdvancementStrategy>;
  calculateConsequences: (zoneSize: number) => NonNullable<ZoneValidationResult['consequences']>;
  getOptimizationSuggestions: (zoneSizes: number[]) => string[];
  
  // Zone capacity helpers
  isZoneDefault: (size: number) => boolean;
  isZoneOverflow: (size: number) => boolean;
  isZoneValid: (size: number) => boolean;
  getMaxCapacity: () => number;
  getDefaultCapacity: () => number;
}

export function useTournamentValidation({
  tournamentId,
  formatId = 'AMERICAN_2',
  enableCaching = true
}: UseTournamentValidationOptions = {}): ZoneValidationHookResult {
  
  // Get tournament configuration (memoized)
  const { rules, config } = useMemo(() => {
    // If we have a tournament ID, get rules from tournament data
    if (tournamentId) {
      // For now, use formatId as fallback
      // In the future, this could fetch from tournament data
      const tournamentConfig = TournamentConfigService.getConfigForFormat(formatId);
      return {
        rules: tournamentConfig.rules,
        config: tournamentConfig
      };
    }
    
    // Use format ID directly
    const formatConfig = TournamentConfigService.getConfigForFormat(formatId);
    return {
      rules: formatConfig.rules,
      config: formatConfig
    };
  }, [tournamentId, formatId]);
  
  // Validation functions (memoized with rules dependency)
  const validateZoneAddition = useCallback((
    currentSize: number, 
    options: any = {}
  ): ZoneValidationResult => {
    return ZoneValidationService.validateZoneAddition(currentSize, rules, options);
  }, [rules]);
  
  const validateZoneMovement = useCallback((
    fromSize: number, 
    toSize: number, 
    hasMatches: boolean = false
  ) => {
    return ZoneValidationService.validateZoneMovement(fromSize, toSize, rules, hasMatches);
  }, [rules]);
  
  const validateZoneRemoval = useCallback((
    currentSize: number, 
    hasMatches: boolean = false
  ): ZoneValidationResult => {
    return ZoneValidationService.validateZoneRemoval(currentSize, rules, hasMatches);
  }, [rules]);
  
  const validateDragDrop = useCallback((
    dragType: 'couple' | 'zone-couple',
    targetSize: number,
    context: any = {}
  ): ZoneValidationResult => {
    return ZoneValidationService.validateDragDrop(dragType, targetSize, rules, context);
  }, [rules]);
  
  // Utility functions
  const getZoneStatusDescription = useCallback((currentSize: number) => {
    return ZoneValidationService.getZoneStatusDescription(currentSize, rules);
  }, [rules]);
  
  const getAdvancementStrategy = useCallback((zoneSize: number) => {
    return TournamentConfigService.getAdvancementStrategy(zoneSize, rules);
  }, [rules]);
  
  const calculateConsequences = useCallback((zoneSize: number) => {
    return ZoneValidationService.calculateConsequences(zoneSize, rules);
  }, [rules]);
  
  const getOptimizationSuggestions = useCallback((zoneSizes: number[]) => {
    return ZoneValidationService.getZoneOptimizationSuggestions(zoneSizes, rules);
  }, [rules]);
  
  // Zone capacity helpers
  const isZoneDefault = useCallback((size: number): boolean => {
    return size <= rules.zoneCapacity.default;
  }, [rules.zoneCapacity.default]);
  
  const isZoneOverflow = useCallback((size: number): boolean => {
    return size > rules.zoneCapacity.default && size <= rules.zoneCapacity.max;
  }, [rules.zoneCapacity.default, rules.zoneCapacity.max]);
  
  const isZoneValid = useCallback((size: number): boolean => {
    return size >= 3 && size <= rules.zoneCapacity.max;
  }, [rules.zoneCapacity.max]);
  
  const getMaxCapacity = useCallback((): number => {
    return rules.zoneCapacity.max;
  }, [rules.zoneCapacity.max]);
  
  const getDefaultCapacity = useCallback((): number => {
    return rules.zoneCapacity.default;
  }, [rules.zoneCapacity.default]);
  
  return {
    // Configuration
    rules,
    config,
    
    // Validation functions
    validateZoneAddition,
    validateZoneMovement,
    validateZoneRemoval,
    validateDragDrop,
    
    // Utility functions
    getZoneStatusDescription,
    getAdvancementStrategy,
    calculateConsequences,
    getOptimizationSuggestions,
    
    // Zone capacity helpers
    isZoneDefault,
    isZoneOverflow,
    isZoneValid,
    getMaxCapacity,
    getDefaultCapacity
  };
}

/**
 * Simplified hook for basic zone validation
 */
export function useZoneValidation(formatId: string = 'AMERICAN_2') {
  const {
    validateZoneAddition,
    isZoneDefault,
    isZoneOverflow,
    isZoneValid,
    getMaxCapacity,
    getDefaultCapacity,
    rules
  } = useTournamentValidation({ formatId });
  
  return {
    validateAddition: validateZoneAddition,
    isDefault: isZoneDefault,
    isOverflow: isZoneOverflow,
    isValid: isZoneValid,
    maxCapacity: getMaxCapacity(),
    defaultCapacity: getDefaultCapacity(),
    rules
  };
}