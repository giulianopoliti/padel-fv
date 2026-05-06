/**
 * American Tournament Strategy
 * - Multiple zones (3-4 couples each)
 * - 1 set per match
 * - No scheduling required
 * - All couples play in zones, then bracket elimination
 */

import type { 
  TournamentStrategy, 
  TournamentFormat, 
  ZoneEntity, 
  CoupleInfo, 
  ZoneConfig,
  CreateMatchRequest,
  MatchResult,
  CoupleStats,
  ZoneStanding,
  ValidationResult,
  TournamentConfig,
  AdvancementConfig
} from '../types/tournament.types';

import { TournamentFormat as NewTournamentFormat } from '@/types';
import { TournamentFormatDetector } from '@/lib/services/tournament-format-detector.service';
import { ZoneEdgeRuleEngine } from '@/lib/services/zone-edge-rule-engine.service';

export class AmericanTournamentStrategy implements TournamentStrategy {
  readonly format: TournamentFormat = 'AMERICAN';
  protected formatType: NewTournamentFormat;

  constructor(formatType: NewTournamentFormat = 'AMERICAN_2') {
    this.formatType = formatType;
  }

  // ============================================================================
  // ZONE MANAGEMENT
  // ============================================================================

  createZones(couples: CoupleInfo[], config: ZoneConfig): ZoneEntity[] {
    const totalCouples = couples.length;
    
    if (totalCouples < 6) {
      throw new Error(`American format requires at least 6 couples. Received: ${totalCouples}`);
    }

    // Use the new format-aware zone distribution
    const optimalConfig = ZoneEdgeRuleEngine.getOptimalZoneConfiguration(totalCouples, this.formatType);
    const rules = TournamentFormatDetector.getZoneRules(this.formatType);
    
    const zones: ZoneEntity[] = [];
    let coupleIndex = 0;

    // Create zones with optimal distribution
    optimalConfig.distribution.forEach((capacity, zoneIndex) => {
      const zoneName = `Zona ${String.fromCharCode(65 + zoneIndex)}`;
      const zoneCouples = couples.slice(coupleIndex, coupleIndex + capacity);
      
      zones.push({
        id: `zone-${zoneIndex}`, // Will be replaced by DB ID
        tournamentId: '', // Will be set by service
        name: zoneName,
        capacity,
        couples: zoneCouples.map(couple => ({
          id: couple.id,
          player1Name: couple.player1Name,
          player2Name: couple.player2Name,
          stats: this.getEmptyStats(),
          canBeMoved: true // New couples can always be moved
        })),
        matches: [],
        standings: [],
        isSingleZone: false,
        isCompleted: false,
        roundsPerCouple: capacity === 5 && this.formatType === 'AMERICAN_2' ? 3 : rules.roundsPerCouple
      });

      coupleIndex += capacity;
    });

    // Log warnings if any
    if (optimalConfig.warnings.length > 0) {
      console.warn('Zone configuration warnings:', optimalConfig.warnings);
    }

    return zones;
  }

  async validateZoneAssignment(zoneId: string, coupleId: string): Promise<ValidationResult> {
    // For American format, couples can be assigned to any zone with capacity
    // Additional business rules would be checked here
    return {
      isValid: true,
      errors: []
    };
  }

  // ============================================================================
  // MATCH MANAGEMENT
  // ============================================================================

  async validateMatchCreation(request: CreateMatchRequest): Promise<ValidationResult> {
    const errors = [];

    // Basic validation
    if (!request.zoneId) {
      errors.push({
        field: 'zoneId',
        message: 'Zone ID is required',
        code: 'REQUIRED_FIELD'
      });
    }

    if (!request.couple1Id || !request.couple2Id) {
      errors.push({
        field: 'couples',
        message: 'Both couples are required',
        code: 'REQUIRED_FIELD'
      });
    }

    if (request.couple1Id === request.couple2Id) {
      errors.push({
        field: 'couples',
        message: 'Couples must be different',
        code: 'INVALID_COUPLES'
      });
    }

    // American format specific validation
    if (request.scheduledTime) {
      // American format doesn't use scheduling
      console.warn('American format does not use scheduled times, ignoring scheduledTime');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  calculateMatchResult(result: MatchResult): CoupleStats {
    // American format: 1 set per match
    if (result.sets.length !== 1) {
      console.warn(`American format expects 1 set, got ${result.sets.length}`);
    }

    const set = result.sets[0] || { setNumber: 1, couple1Score: 0, couple2Score: 0 };

    return {
      played: 1,
      won: result.winnerId ? 1 : 0,
      lost: result.winnerId ? 0 : 1,
      setsWon: set.couple1Score > set.couple2Score ? 1 : 0,
      setsLost: set.couple1Score < set.couple2Score ? 1 : 0,
      gamesWon: set.couple1Score,
      gamesLost: set.couple2Score,
      points: set.couple1Score - set.couple2Score
    };
  }

  // ============================================================================
  // ADVANCEMENT LOGIC
  // ============================================================================

  calculateZoneStandings(zone: ZoneEntity): ZoneStanding[] {
    const standings: ZoneStanding[] = [];

    zone.couples.forEach((couple, index) => {
      standings.push({
        position: index + 1, // Will be recalculated based on stats
        coupleId: couple.id,
        stats: couple.stats,
        isDefinitive: this.isPositionDefinitive(couple, zone),
        advancesToBracket: index < 2 // Top 2 from each zone advance (typical)
      });
    });

    // Sort by American format criteria: points desc, then games won desc
    standings.sort((a, b) => {
      if (a.stats.points !== b.stats.points) {
        return b.stats.points - a.stats.points;
      }
      return b.stats.gamesWon - a.stats.gamesWon;
    });

    // Update positions after sorting
    standings.forEach((standing, index) => {
      standing.position = index + 1;
    });

    return standings;
  }

  determineAdvancementToBracket(standings: ZoneStanding[], config?: AdvancementConfig): string[] {
    // American format: typically top 2 from each zone
    const advancingCount = config?.couplesAdvanceFromZone || 2;
    
    return standings
      .filter(s => s.isDefinitive)
      .slice(0, advancingCount)
      .map(s => s.coupleId);
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  getDefaultConfig(): TournamentConfig {
    return {
      maxCouplesPerZone: 4,
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

  requiresScheduling(): boolean {
    return false;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private calculateZoneDistribution(totalCouples: number): number[] {
    // Existing logic from createEmptyZones in actions.ts
    let numZonesOf4 = 0;
    let numZonesOf3 = 0;

    switch (totalCouples % 4) {
      case 0:
        numZonesOf4 = totalCouples / 4;
        break;
      case 1:
        if (totalCouples < 9) {
          throw new Error(`Cannot create zones with ${totalCouples} couples (remainder 1). Minimum 9 required.`);
        }
        numZonesOf4 = Math.floor(totalCouples / 4) - 2;
        numZonesOf3 = 3;
        break;
      case 2:
        numZonesOf4 = Math.floor(totalCouples / 4) - 1;
        numZonesOf3 = 2;
        break;
      case 3:
        numZonesOf4 = Math.floor(totalCouples / 4);
        numZonesOf3 = 1;
        break;
    }

    const distribution: number[] = [];
    
    // Add zones of 4
    for (let i = 0; i < numZonesOf4; i++) {
      distribution.push(4);
    }
    
    // Add zones of 3
    for (let i = 0; i < numZonesOf3; i++) {
      distribution.push(3);
    }

    return distribution;
  }

  private isPositionDefinitive(couple: any, zone: ZoneEntity): boolean {
    // Simple logic: if couple has played all possible matches in zone
    const totalCouples = zone.couples.length;
    const expectedMatches = totalCouples - 1; // Round robin
    
    return couple.stats.played >= expectedMatches;
  }

  private getEmptyStats(): CoupleStats {
    return {
      played: 0,
      won: 0,
      lost: 0,
      setsWon: 0,
      setsLost: 0,
      gamesWon: 0,
      gamesLost: 0,
      points: 0
    };
  }
}