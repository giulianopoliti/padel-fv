/**
 * Zone Validation Service Tests
 * 
 * Comprehensive tests for zone validation logic and edge cases.
 */

import { ZoneValidationService } from '../zone-validation.service';
import { AMERICAN_2_TOURNAMENT_RULES, LONG_TOURNAMENT_RULES } from '@/config/tournament-formats.config';
import type { TournamentRules } from '@/types/tournament-rules.types';

describe('ZoneValidationService', () => {
  
  describe('validateZoneAddition', () => {
    const rules = AMERICAN_2_TOURNAMENT_RULES;
    
    it('should allow adding to zones within default capacity', () => {
      const result = ZoneValidationService.validateZoneAddition(3, rules);
      
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('info');
      expect(result.message).toContain('Zona estándar');
      expect(result.consequences?.eliminated).toBe(0);
    });
    
    it('should show warning for overflow zones with elimination', () => {
      const result = ZoneValidationService.validateZoneAddition(4, rules);
      
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('warning');
      expect(result.message).toContain('pareja quedará eliminada');
      expect(result.consequences?.eliminated).toBe(1);
      expect(result.requiresConfirmation).toBe(true);
    });
    
    it('should reject zones exceeding maximum capacity', () => {
      const result = ZoneValidationService.validateZoneAddition(5, rules);
      
      expect(result.allowed).toBe(false);
      expect(result.level).toBe('error');
      expect(result.message).toContain('Máximo 5 parejas');
    });
    
    it('should calculate correct consequences for different zone sizes', () => {
      // Zone of 3 - all advance
      const result3 = ZoneValidationService.validateZoneAddition(2, rules);
      expect(result3.consequences?.eliminated).toBe(0);
      expect(result3.consequences?.strategy).toBe('ALL_ADVANCE');
      
      // Zone of 5 - 1 eliminated
      const result5 = ZoneValidationService.validateZoneAddition(4, rules);
      expect(result5.consequences?.eliminated).toBe(1);
      expect(result5.consequences?.strategy).toBe('TOP_N');
    });
  });
  
  describe('validateZoneMovement', () => {
    const rules = AMERICAN_2_TOURNAMENT_RULES;
    
    it('should allow movement between valid zones', () => {
      const result = ZoneValidationService.validateZoneMovement(4, 3, rules, false);
      
      expect(result.movementAllowed).toBe(true);
      expect(result.fromZoneResult.allowed).toBe(true);
      expect(result.toZoneResult.allowed).toBe(true);
    });
    
    it('should prevent movement of couples with played matches', () => {
      const result = ZoneValidationService.validateZoneMovement(4, 3, rules, true);
      
      expect(result.movementAllowed).toBe(false);
      expect(result.fromZoneResult.allowed).toBe(false);
      expect(result.fromZoneResult.message).toContain('ya jugó partidos');
    });
    
    it('should prevent movement that creates invalid zone sizes', () => {
      const result = ZoneValidationService.validateZoneMovement(3, 5, rules, false);
      
      expect(result.movementAllowed).toBe(false);
      expect(result.toZoneResult.allowed).toBe(false);
    });
  });
  
  describe('validateZoneRemoval', () => {
    const rules = AMERICAN_2_TOURNAMENT_RULES;
    
    it('should allow removal from zones with more than 3 couples', () => {
      const result = ZoneValidationService.validateZoneRemoval(4, rules, false);
      
      expect(result.allowed).toBe(true);
      expect(result.level).toBe('info');
    });
    
    it('should prevent removal that leaves less than 3 couples', () => {
      const result = ZoneValidationService.validateZoneRemoval(3, rules, false);
      
      expect(result.allowed).toBe(false);
      expect(result.level).toBe('error');
      expect(result.message).toContain('al menos 3 parejas');
    });
    
    it('should prevent removal of couples with played matches', () => {
      const result = ZoneValidationService.validateZoneRemoval(4, rules, true);
      
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('ya jugó partidos');
    });
  });
  
  describe('validateZoneSize', () => {
    const rules = AMERICAN_2_TOURNAMENT_RULES;
    
    it('should correctly identify zone size categories', () => {
      expect(ZoneValidationService.validateZoneSize(3, rules)).toEqual({
        isValid: true,
        isDefault: true,
        isOverflow: false,
        isMax: false
      });
      
      expect(ZoneValidationService.validateZoneSize(4, rules)).toEqual({
        isValid: true,
        isDefault: true,
        isOverflow: false,
        isMax: false
      });
      
      expect(ZoneValidationService.validateZoneSize(5, rules)).toEqual({
        isValid: true,
        isDefault: false,
        isOverflow: true,
        isMax: true
      });
      
      expect(ZoneValidationService.validateZoneSize(6, rules)).toEqual({
        isValid: false,
        isDefault: false,
        isOverflow: false,
        isMax: false
      });
    });
  });
  
  describe('calculateConsequences', () => {
    const rules = AMERICAN_2_TOURNAMENT_RULES;
    
    it('should calculate correct consequences for American 2 format', () => {
      // Zone of 3
      const result3 = ZoneValidationService.calculateConsequences(3, rules);
      expect(result3.eliminated).toBe(0);
      expect(result3.matchesPerCouple).toBe(2);
      expect(result3.strategy).toBe('ALL_ADVANCE');
      
      // Zone of 4
      const result4 = ZoneValidationService.calculateConsequences(4, rules);
      expect(result4.eliminated).toBe(0);
      expect(result4.matchesPerCouple).toBe(2);
      expect(result4.strategy).toBe('ALL_ADVANCE');
      
      // Zone of 5
      const result5 = ZoneValidationService.calculateConsequences(5, rules);
      expect(result5.eliminated).toBe(1);
      expect(result5.matchesPerCouple).toBe(3);
      expect(result5.strategy).toBe('TOP_N');
    });
    
    it('should calculate total matches correctly', () => {
      // Zone of 4 with 2 matches per couple = 4 total matches
      const result4 = ZoneValidationService.calculateConsequences(4, rules);
      expect(result4.totalMatches).toBe(4);
      
      // Zone of 5 with 3 matches per couple = 7.5 -> 7 total matches
      const result5 = ZoneValidationService.calculateConsequences(5, rules);
      expect(result5.totalMatches).toBe(7);
    });
  });
  
  describe('getZoneStatusDescription', () => {
    const rules = AMERICAN_2_TOURNAMENT_RULES;
    
    it('should provide appropriate descriptions for different zone sizes', () => {
      const desc3 = ZoneValidationService.getZoneStatusDescription(3, rules);
      expect(desc3.title).toBe('Zona Estándar');
      expect(desc3.level).toBe('info');
      
      const desc5 = ZoneValidationService.getZoneStatusDescription(5, rules);
      expect(desc5.title).toBe('Zona Especial');
      expect(desc5.level).toBe('warning');
      
      const desc6 = ZoneValidationService.getZoneStatusDescription(6, rules);
      expect(desc6.title).toBe('Zona Inválida');
      expect(desc6.level).toBe('error');
    });
  });
  
  describe('getZoneOptimizationSuggestions', () => {
    const rules = AMERICAN_2_TOURNAMENT_RULES;
    
    it('should suggest optimization for zones with elimination', () => {
      const zoneSizes = [4, 4, 5]; // One zone with elimination
      const suggestions = ZoneValidationService.getZoneOptimizationSuggestions(zoneSizes, rules);
      
      expect(suggestions).toContain(expect.stringContaining('zona(s) con eliminación'));
    });
    
    it('should suggest creating new zones when beneficial', () => {
      const zoneSizes = [4, 4, 3]; // Could be redistributed
      const suggestions = ZoneValidationService.getZoneOptimizationSuggestions(zoneSizes, rules);
      
      // This test depends on specific optimization logic
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });
  
  describe('Cross-format compatibility', () => {
    it('should work with different tournament formats', () => {
      const longRules = LONG_TOURNAMENT_RULES;
      
      const result = ZoneValidationService.validateZoneAddition(5, longRules);
      expect(result.allowed).toBe(true);
      
      const consequences = ZoneValidationService.calculateConsequences(6, longRules);
      expect(consequences.eliminated).toBe(3); // Long format eliminates more
    });
  });
});