/**
 * Domain types for Tournament Management System
 * Extensible architecture for multiple tournament formats
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type TournamentFormat = 'AMERICAN' | 'LONG';

export type TournamentStatus = 
  // New simplified states
  | 'NOT_STARTED'
  | 'ZONE_PHASE' 
  | 'BRACKET_PHASE'
  | 'FINISHED'
  | 'CANCELED'
  | 'FINISHED_POINTS_PENDING'
  | 'FINISHED_POINTS_CALCULATED'
  // Legacy states (backward compatibility)
  | 'PAIRING'
  | 'ZONE_REGISTRATION'
  | 'IN_PROGRESS'
  | 'ZONES_READY'
  | 'MATCHES_READY'
  | 'ELIMINATION';

export type MatchStatus = 'PENDING' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';

export type MatchRound = 'ZONE' | '32VOS' | '16VOS' | '8VOS' | '4TOS' | 'SEMIFINAL' | 'FINAL';

// ============================================================================
// CORE DOMAIN ENTITIES
// ============================================================================

export interface TournamentEntity {
  id: string;
  name: string;
  clubId: string;
  format: TournamentFormat;
  status: TournamentStatus;
  createdAt: Date;
  startDate?: Date;
  endDate?: Date;
  
  // Format-specific configuration
  config: TournamentConfig;
  
  // Statistics
  totalCouples: number;
  currentPhase: string;
  
  // Metadata
  bracketGeneratedAt?: Date;
  usesNewZoneSystem: boolean;
}

export interface TournamentConfig {
  // Common config
  maxCouplesPerZone: number;
  courtCount: number;
  
  // Format-specific config
  setsPerMatch: number; // 1 for American, 3 for Long
  hasSchedule: boolean; // true for Long format
  
  // Zone configuration
  zoneConfiguration: ZoneConfig;
  
  // Advancement rules (for Long format)
  advancementRules?: AdvancementConfig;
}

export interface ZoneConfig {
  type: 'MULTIPLE' | 'SINGLE';
  maxCouplesPerZone: number;
  minCouplesPerZone: number;
}

export interface AdvancementConfig {
  couplesAdvanceFromZone: number; // Owner decides how many advance
  advancementCriteria: 'POSITION' | 'POINTS' | 'WINS';
}

// ============================================================================
// MATCH ENTITIES
// ============================================================================

export interface MatchEntity {
  id: string;
  tournamentId: string;
  zoneId: string; // CRITICAL: Always present
  couple1Id: string;
  couple2Id: string;
  
  // Match details
  status: MatchStatus;
  round: MatchRound;
  court?: number;
  
  // Results (extensible for multiple sets)
  result?: MatchResult;
  
  // Scheduling (for Long format)
  scheduledTime?: Date;
  
  // Metadata
  createdAt: Date;
  type: 'ZONE' | 'ELIMINATION';
}

export interface MatchResult {
  // Flexible result structure for multiple formats
  sets: SetResult[];
  winnerId: string;
  totalScore: {
    couple1: number;
    couple2: number;
  };
}

export interface SetResult {
  setNumber: number;
  couple1Score: number;
  couple2Score: number;
}

// Enhanced match with relations
export interface MatchWithRelations extends MatchEntity {
  zone: ZoneInfo;
  couple1: CoupleInfo;
  couple2: CoupleInfo;
  tournament: TournamentInfo;
}

// ============================================================================
// ZONE ENTITIES
// ============================================================================

export interface ZoneEntity {
  id: string;
  tournamentId: string;
  name: string;
  capacity: number;
  
  // Zone state
  couples: CoupleInZone[];
  matches: MatchEntity[];
  standings: ZoneStanding[];
  
  // Zone configuration
  isSingleZone: boolean;
  isCompleted: boolean;
}

export interface CoupleInZone {
  id: string;
  player1Name: string;
  player2Name: string;
  stats: CoupleStats;
  canBeMoved: boolean; // Based on match history
}

export interface CoupleStats {
  played: number;
  won: number;
  lost: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  points: number; // Calculated based on format
}

export interface ZoneStanding {
  position: number;
  coupleId: string;
  stats: CoupleStats;
  isDefinitive: boolean;
  advancesToBracket: boolean; // For Long format
}

// ============================================================================
// AUXILIARY TYPES
// ============================================================================

export interface ZoneInfo {
  id: string;
  name: string;
}

export interface CoupleInfo {
  id: string;
  player1Name: string;
  player2Name: string;
}

export interface TournamentInfo {
  id: string;
  name: string;
  format: TournamentFormat;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateTournamentRequest {
  name: string;
  clubId: string;
  format: TournamentFormat;
  config: TournamentConfig;
}

export interface CreateMatchRequest {
  tournamentId: string;
  zoneId: string;
  couple1Id: string;
  couple2Id: string;
  court?: number;
  scheduledTime?: Date; // For Long format
}

export interface UpdateMatchResultRequest {
  matchId: string;
  result: MatchResult;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// ============================================================================
// STRATEGY PATTERN INTERFACES  
// ============================================================================

export interface TournamentStrategy {
  format: TournamentFormat;
  
  // Zone management
  createZones(couples: CoupleInfo[], config: ZoneConfig): ZoneEntity[];
  validateZoneAssignment(zoneId: string, coupleId: string): Promise<ValidationResult>;
  
  // Match management
  validateMatchCreation(request: CreateMatchRequest): Promise<ValidationResult>;
  calculateMatchResult(result: MatchResult): CoupleStats;
  
  // Advancement
  calculateZoneStandings(zone: ZoneEntity): ZoneStanding[];
  determineAdvancementToBracket(standings: ZoneStanding[], config: AdvancementConfig): string[];
  
  // Configuration
  getDefaultConfig(): TournamentConfig;
  getSetsPerMatch(): number;
  requiresScheduling(): boolean;
}