/**
 * POINTS CONFIG SERVICE
 *
 * Provides tournament-specific points configuration
 */

import { POINTS_CONFIGS, TournamentPointsConfig, TournamentType } from '../types';

export class PointsConfigService {
  /**
   * Gets points configuration for a specific tournament type
   */
  static getConfig(tournamentType: TournamentType): TournamentPointsConfig {
    return POINTS_CONFIGS[tournamentType];
  }

  /**
   * Gets points configuration for a tournament object
   */
  static getConfigForTournament(tournament: {
    type: TournamentType;
  }): TournamentPointsConfig {
    return this.getConfig(tournament.type);
  }

  /**
   * Gets all available configurations
   */
  static getAllConfigs(): Record<TournamentType, TournamentPointsConfig> {
    return POINTS_CONFIGS;
  }

  /**
   * Validates if a tournament type is supported
   */
  static isValidTournamentType(type: string): type is TournamentType {
    return type === 'AMERICAN' || type === 'LONG';
  }

  /**
   * Gets human-readable description of points configuration
   */
  static getConfigDescription(tournamentType: TournamentType): string {
    const config = this.getConfig(tournamentType);
    return `Base: +${config.baseWinner}/${config.baseLoser} pts | Bonus: Champion +${config.bonusChampion}, Finalist +${config.bonusFinalist}`;
  }
}
