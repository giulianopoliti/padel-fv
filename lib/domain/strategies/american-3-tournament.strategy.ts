/**
 * American 3 Tournament Strategy
 * - 3 rounds per couple (always, regardless of zone size)
 * - 1 set per match
 * - Stricter zone size limits (max 4 couples)
 */

import { AmericanTournamentStrategy } from './american-tournament.strategy';
import type { TournamentConfig } from '../types/tournament.types';

export class American3TournamentStrategy extends AmericanTournamentStrategy {
  
  constructor() {
    super('AMERICAN_3');
  }

  getDefaultConfig(): TournamentConfig {
    return {
      maxCouplesPerZone: 4, // Strict limit for consistent 3-round format
      courtCount: 4,
      setsPerMatch: 1,
      hasSchedule: false,
      zoneConfiguration: {
        type: 'MULTIPLE',
        maxCouplesPerZone: 4,
        minCouplesPerZone: 3
      },
      advancementRules: {
        couplesAdvanceFromZone: 2,
        advancementCriteria: 'POINTS'
      }
    };
  }

  getSetsPerMatch(): number {
    return 1;
  }

  /**
   * Always returns 3 rounds per couple regardless of zone size
   */
  getRoundsPerCouple(zoneSize: number): number {
    return 3;
  }

  /**
   * Validates zone size - stricter than American 2
   */
  validateZoneSize(zoneSize: number): { valid: boolean; warning?: string } {
    if (zoneSize > 4) {
      return {
        valid: false,
        warning: 'American 3 no permite zonas con más de 4 parejas. Crear zona adicional.'
      };
    }

    if (zoneSize < 3) {
      return {
        valid: false,
        warning: 'Se requieren al menos 3 parejas para crear una zona'
      };
    }

    return { valid: true };
  }

  /**
   * More strict zone overflow handling - prefer creating new zones
   */
  shouldCreateNewZone(currentZoneSize: number, newCouples: number): boolean {
    return (currentZoneSize + newCouples) > 4;
  }
}