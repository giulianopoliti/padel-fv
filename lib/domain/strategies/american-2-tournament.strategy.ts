/**
 * American 2 Tournament Strategy
 * - 2 rounds per couple (except 5-couple zones which play 3)
 * - 1 set per match
 * - Handles edge case of 5 couples intelligently
 */

import { AmericanTournamentStrategy } from './american-tournament.strategy';
import type { TournamentConfig } from '../types/tournament.types';

export class American2TournamentStrategy extends AmericanTournamentStrategy {
  
  constructor() {
    super('AMERICAN_2');
  }

  getDefaultConfig(): TournamentConfig {
    return {
      maxCouplesPerZone: 5, // Allow up to 5 for edge case handling
      courtCount: 4,
      setsPerMatch: 1,
      hasSchedule: false,
      zoneConfiguration: {
        type: 'MULTIPLE',
        maxCouplesPerZone: 5,
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
   * Returns rounds per couple based on zone size
   * - 4 couples or less: 2 rounds
   * - 5 couples: 3 rounds (edge case)
   */
  getRoundsPerCouple(zoneSize: number): number {
    return zoneSize === 5 ? 3 : 2;
  }

  /**
   * Validates that a 5-couple zone is acceptable
   */
  validateZoneSize(zoneSize: number): { valid: boolean; warning?: string } {
    if (zoneSize === 5) {
      return {
        valid: true,
        warning: 'Esta zona tendrá 5 parejas y jugará 3 partidos por pareja en lugar de 2'
      };
    }
    
    if (zoneSize > 5) {
      return {
        valid: false,
        warning: 'American 2 no permite zonas con más de 5 parejas'
      };
    }

    return { valid: true };
  }
}