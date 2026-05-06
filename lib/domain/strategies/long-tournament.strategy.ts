/**
 * Long Tournament Strategy
 * - Single zone (all couples together)
 * - 3 sets per match  
 * - Scheduling required
 * - Owner decides how many couples advance to bracket
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

export class LongTournamentStrategy implements TournamentStrategy {
  readonly format: TournamentFormat = 'LONG';

  // ============================================================================
  // ZONE MANAGEMENT
  // ============================================================================

  createZones(couples: CoupleInfo[], config: ZoneConfig): ZoneEntity[] {
    // Long format: Single zone with all couples
    const totalCouples = couples.length;
    
    if (totalCouples < 4) {
      throw new Error(`Long format requires at least 4 couples. Received: ${totalCouples}`);
    }

    // Create single zone containing all couples
    const zone: ZoneEntity = {
      id: 'long-zone-1', // Will be replaced by DB ID
      tournamentId: '', // Will be set by service
      name: 'Zona Única',
      capacity: totalCouples,
      couples: couples.map(couple => ({
        id: couple.id,
        player1Name: couple.player1Name,
        player2Name: couple.player2Name,
        stats: this.getEmptyStats(),
        canBeMoved: true // Initial state allows movement
      })),
      matches: [],
      standings: [],
      isSingleZone: true,
      isCompleted: false
    };

    return [zone];
  }

  async validateZoneAssignment(zoneId: string, coupleId: string): Promise<ValidationResult> {
    // Long format has single zone - all couples go to same zone
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

    // Long format specific validation
    if (request.scheduledTime) {
      const now = new Date();
      if (request.scheduledTime <= now) {
        errors.push({
          field: 'scheduledTime',
          message: 'Scheduled time must be in the future',
          code: 'INVALID_SCHEDULE'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  calculateMatchResult(result: MatchResult): CoupleStats {
    // Long format: 3 sets per match
    if (result.sets.length !== 3) {
      console.warn(`Long format expects 3 sets, got ${result.sets.length}`);
    }

    let setsWon = 0;
    let setsLost = 0;
    let totalGamesWon = 0;
    let totalGamesLost = 0;

    result.sets.forEach(set => {
      if (set.couple1Score > set.couple2Score) {
        setsWon++;
      } else {
        setsLost++;
      }
      totalGamesWon += set.couple1Score;
      totalGamesLost += set.couple2Score;
    });

    // Long format points: Set difference + game difference
    const setDifference = setsWon - setsLost;
    const gameDifference = totalGamesWon - totalGamesLost;
    const points = (setDifference * 10) + gameDifference; // Weight sets more heavily

    return {
      played: 1,
      won: result.winnerId ? 1 : 0,
      lost: result.winnerId ? 0 : 1,
      setsWon,
      setsLost,
      gamesWon: totalGamesWon,
      gamesLost: totalGamesLost,
      points
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
        advancesToBracket: false // Will be determined by owner decision
      });
    });

    // Sort by Long format criteria: points desc, then sets won desc, then games won desc
    standings.sort((a, b) => {
      if (a.stats.points !== b.stats.points) {
        return b.stats.points - a.stats.points;
      }
      if (a.stats.setsWon !== b.stats.setsWon) {
        return b.stats.setsWon - a.stats.setsWon;
      }
      return b.stats.gamesWon - a.stats.gamesWon;
    });

    // Update positions after sorting
    standings.forEach((standing, index) => {
      standing.position = index + 1;
    });

    return standings;
  }

  determineAdvancementToBracket(standings: ZoneStanding[], config: AdvancementConfig): string[] {
    // Long format: owner decides how many couples advance
    const advancingCount = config.couplesAdvanceFromZone;
    
    // Only definitive positions can advance
    const definitiveStandings = standings.filter(s => s.isDefinitive);
    
    return definitiveStandings
      .slice(0, advancingCount)
      .map(s => s.coupleId);
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  getDefaultConfig(): TournamentConfig {
    return {
      maxCouplesPerZone: 32, // Single zone can handle many couples
      courtCount: 4,
      setsPerMatch: 3,
      hasSchedule: true,
      zoneConfiguration: {
        type: 'SINGLE',
        maxCouplesPerZone: 32,
        minCouplesPerZone: 4
      },
      advancementRules: {
        couplesAdvanceFromZone: 8, // Default suggestion, owner can change
        advancementCriteria: 'POINTS'
      }
    };
  }

  getSetsPerMatch(): number {
    return 3;
  }

  requiresScheduling(): boolean {
    return true;
  }

  // ============================================================================
  // SCHEDULING HELPERS
  // ============================================================================

  generateScheduleSuggestions(
    couples: CoupleInfo[], 
    availableCourts: number,
    startTime: Date,
    matchDurationMinutes: number = 90 // Long format matches take longer
  ): { couple1Id: string; couple2Id: string; suggestedTime: Date; court: number }[] {
    const suggestions = [];
    const currentTime = new Date(startTime);
    
    // Generate round-robin matches with time slots
    for (let i = 0; i < couples.length; i++) {
      for (let j = i + 1; j < couples.length; j++) {
        const courtIndex = suggestions.length % availableCourts;
        const timeSlot = new Date(currentTime.getTime() + (Math.floor(suggestions.length / availableCourts) * matchDurationMinutes * 60000));
        
        suggestions.push({
          couple1Id: couples[i].id,
          couple2Id: couples[j].id,
          suggestedTime: timeSlot,
          court: courtIndex + 1
        });
      }
    }
    
    return suggestions;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private isPositionDefinitive(couple: any, zone: ZoneEntity): boolean {
    // For Long format, position is definitive when:
    // 1. All matches are played, OR
    // 2. Mathematical impossibility for position to change
    
    const totalCouples = zone.couples.length;
    const expectedMatches = totalCouples - 1; // Round robin
    
    // Simple approach: definitive when all matches played
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