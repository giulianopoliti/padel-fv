import {
  TournamentType,
  TournamentFormatConfig,
  ZoneCreationResult,
  SeedingStrategy,
  SeedingResult,
  CoupleRanking,
  Zone,
  Couple
} from '@/types/tournament-formats';
import { ZonePosition } from '@/types';

/**
 * Main interface for tournament format management
 * Abstracts different tournament types (AMERICAN, LONG) behind a common interface
 */
export interface TournamentFormatManager {
  // Configuration
  getFormatConfig(): TournamentFormatConfig;
  getTournamentType(): TournamentType;
  validateCoupleCount(count: number): { valid: boolean; message?: string };

  // Zone Phase Management
  createZones(couples: Couple[]): Promise<ZoneCreationResult>;
  validateZoneConfiguration(zones: Zone[]): boolean;
  getOptimalZoneDistribution(coupleCount: number): {
    zoneCount: number;
    couplesPerZone: number[];
    recommendations?: string[];
  };

  // Seeding Phase Management
  getSeedingStrategy(): SeedingStrategy;
  getAdvancingCouples(
    tournamentId: string,
    zoneResults: ZonePosition[]
  ): Promise<CoupleRanking[]>;

  // Bracket Phase Management
  generateSeedingOrder(couples: CoupleRanking[]): CoupleRanking[];
  getBracketSize(advancingCount: number): number;
  calculateAdvancingCount(
    zoneResults: ZonePosition[],
    tournamentConfig?: any
  ): number;

  // Validation Methods
  canGenerateBracket(
    tournamentId: string,
    zoneResults: ZonePosition[]
  ): Promise<{ canGenerate: boolean; reason?: string }>;

  // Format-specific business rules
  getBusinessRules(): {
    requiresCompleteZones: boolean;
    allowsPartialAdvancement: boolean;
    minimumAdvancers: number;
    maximumAdvancers?: number;
  };
}

/**
 * Abstract base class with common functionality
 */
export abstract class BaseTournamentFormatManager implements TournamentFormatManager {
  protected config: TournamentFormatConfig;
  protected tournamentType: TournamentType;

  constructor(config: TournamentFormatConfig, type: TournamentType) {
    this.config = config;
    this.tournamentType = type;
  }

  getFormatConfig(): TournamentFormatConfig {
    return this.config;
  }

  getTournamentType(): TournamentType {
    return this.tournamentType;
  }

  validateZoneConfiguration(zones: Zone[]): boolean {
    // Basic validation - can be overridden by specific implementations
    return zones.every(zone =>
      zone.couples.length >= 2 &&
      zone.couples.length <= this.config.zoneCapacity.max
    );
  }

  getBracketSize(advancingCount: number): number {
    // Find next power of 2 that accommodates all advancing couples
    return Math.pow(2, Math.ceil(Math.log2(advancingCount)));
  }

  // Abstract methods that must be implemented by concrete classes
  abstract validateCoupleCount(count: number): { valid: boolean; message?: string };
  abstract createZones(couples: Couple[]): Promise<ZoneCreationResult>;
  abstract getOptimalZoneDistribution(coupleCount: number): {
    zoneCount: number;
    couplesPerZone: number[];
    recommendations?: string[];
  };
  abstract getSeedingStrategy(): SeedingStrategy;
  abstract getAdvancingCouples(
    tournamentId: string,
    zoneResults: ZonePosition[]
  ): Promise<CoupleRanking[]>;
  abstract generateSeedingOrder(couples: CoupleRanking[]): CoupleRanking[];
  abstract calculateAdvancingCount(
    zoneResults: ZonePosition[],
    tournamentConfig?: any
  ): number;
  abstract canGenerateBracket(
    tournamentId: string,
    zoneResults: ZonePosition[]
  ): Promise<{ canGenerate: boolean; reason?: string }>;
  abstract getBusinessRules(): {
    requiresCompleteZones: boolean;
    allowsPartialAdvancement: boolean;
    minimumAdvancers: number;
    maximumAdvancers?: number;
  };
}