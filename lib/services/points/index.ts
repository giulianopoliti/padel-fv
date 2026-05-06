/**
 * POINTS SYSTEM - MAIN EXPORTS
 *
 * Complete tournament points calculation system with ELO-like algorithm
 * Supports different tournament types with configurable point values
 */

// === Main Services ===
export { PointsCalculatorService } from './services/points.calculator.service';
export { PointsApplicationService } from './services/points.application.service';
export { PointsConfigService } from './config/points.config.service';

// === Calculators ===
export { EloPointsCalculator } from './calculators/elo-points.calculator';
export { MatchPointsCalculator } from './calculators/match-points.calculator';
export { BonusPointsCalculator } from './calculators/bonus-points.calculator';

// === Types ===
export type {
  TournamentType,
  TournamentPointsConfig,
  PlayerSnapshot,
  PlayerSnapshotMap,
  MatchPointsInput,
  MatchPointsResult,
  PlayerMatchPoints,
  PlayerPointsUpdate,
  MatchPointsCouple,
  PointsCalculationResult,
  BonusApplicationResult
} from './types';

export { POINTS_CONFIGS } from './types';

// === High-Level API ===

/**
 * Calculate points for a tournament (preview without applying)
 *
 * @example
 * const result = await calculateTournamentPoints(tournamentId, supabase);
 * console.log(result.playerUpdates); // Preview changes
 */
export async function calculateTournamentPoints(
  tournamentId: string,
  supabase: any
) {
  const { PointsCalculatorService } = await import('./services/points.calculator.service');
  return PointsCalculatorService.calculateTournamentPoints(tournamentId, supabase);
}

/**
 * Calculate and apply points for a tournament
 *
 * @example
 * const result = await processTournamentPoints(tournamentId, supabase);
 * if (result.success) {
 *   console.log('Points applied successfully');
 * }
 */
export async function processTournamentPoints(
  tournamentId: string,
  supabase: any
) {
  const { PointsCalculatorService } = await import('./services/points.calculator.service');
  const { PointsApplicationService } = await import('./services/points.application.service');

  const calculation = await PointsCalculatorService.calculateTournamentPoints(
    tournamentId,
    supabase
  );

  return PointsApplicationService.applyPoints(calculation, supabase);
}

/**
 * Get points configuration for a tournament type
 *
 * @example
 * const config = getPointsConfig('AMERICAN');
 * console.log(`Winner gets: ${config.baseWinner} points`);
 */
export function getPointsConfig(tournamentType: 'AMERICAN' | 'LONG') {
  const { PointsConfigService } = require('./config/points.config.service');
  return PointsConfigService.getConfig(tournamentType);
}
