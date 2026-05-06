// Tournament Format Types - Backend Abstraction
// Uses existing tournament_type enum from database: 'AMERICAN' | 'LONG'

export type TournamentType = 'AMERICAN' | 'LONG';

// Configuration for different tournament formats
export interface TournamentFormatConfig {
  name: string;
  zoneRounds: number;
  setsPerMatch: number;
  zoneCapacity: {
    ideal: number;
    max: number;
  };
  multipleZones: boolean;
  // For AMERICAN: number of couples that advance per zone
  advancersPerZone?: number;
  // For LONG: total number of couples that advance from single zone
  totalAdvancers?: number;
}

// Zone creation result
export interface ZoneCreationResult {
  zones: Zone[];
  totalCouples: number;
  distribution: Record<string, number>;
}

// Seeding strategy types
export type SeedingStrategy = 'by-zones' | 'by-performance' | 'by-qualy-position';

// Seeding result
export interface SeedingResult {
  strategy: SeedingStrategy;
  seeds: CoupleRanking[];
  definitive: number;
  placeholders: number;
}

// Couple ranking for seeding
export interface CoupleRanking {
  coupleId: string;
  rank: number;
  zoneName?: string; // For AMERICAN: "Zona A", "Zona B", etc.
  zonePosition?: number; // Position within zone (1, 2, 3...)
  performance?: {
    wins: number;
    losses: number;
    gamesFor: number;
    gamesAgainst: number;
    gamesDifference: number;
  };
}

// Zone reference - reuse existing Zone type
export interface Zone {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  couples: Couple[];
  max_couples?: number;
  rounds_per_couple?: number;
}

// Couple reference - reuse existing Couple type
export interface Couple {
  id: string;
  player_1: string;
  player_2: string;
}

// Predefined tournament format configurations
export const TOURNAMENT_FORMATS: Record<TournamentType, TournamentFormatConfig> = {
  AMERICAN: {
    name: "Torneo Americano",
    zoneRounds: 2, // Default, can be 2 or 3
    setsPerMatch: 1,
    zoneCapacity: { ideal: 4, max: 6 },
    multipleZones: true,
    advancersPerZone: 2 // Top 2 from each zone advance
  },
  LONG: {
    name: "Torneo Largo",
    zoneRounds: 3,
    setsPerMatch: 3,
    zoneCapacity: { ideal: 8, max: 16 },
    multipleZones: false,
    totalAdvancers: 8 // Configurable per tournament
  }
};