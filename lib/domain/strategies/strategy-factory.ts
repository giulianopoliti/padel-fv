/**
 * Tournament Strategy Factory
 * Creates appropriate strategy instance based on tournament format
 */

import { TournamentStrategy, TournamentFormat } from '../types/tournament.types';
import { AmericanTournamentStrategy } from './american-tournament.strategy';
import { American2TournamentStrategy } from './american-2-tournament.strategy';
import { American3TournamentStrategy } from './american-3-tournament.strategy';
import { LongTournamentStrategy } from './long-tournament.strategy';
import { TournamentFormat as NewTournamentFormat } from '@/types';
import { TournamentFormatDetector } from '@/lib/services/tournament-format-detector.service';

export class TournamentStrategyFactory {
  private static strategies: Map<TournamentFormat, TournamentStrategy> = new Map([
    ['AMERICAN', new AmericanTournamentStrategy()],
    ['LONG', new LongTournamentStrategy()]
  ]);

  private static newFormatStrategies: Map<NewTournamentFormat, TournamentStrategy> = new Map([
    ['AMERICAN_2', new American2TournamentStrategy()],
    ['AMERICAN_3', new American3TournamentStrategy()],
    ['LONG', new LongTournamentStrategy()]
  ]);

  static getStrategy(format: TournamentFormat): TournamentStrategy {
    const strategy = this.strategies.get(format);
    
    if (!strategy) {
      throw new Error(`Unsupported tournament format: ${format}`);
    }
    
    return strategy;
  }

  static getNewFormatStrategy(format: NewTournamentFormat): TournamentStrategy {
    const strategy = this.newFormatStrategies.get(format);
    
    if (!strategy) {
      throw new Error(`Unsupported new tournament format: ${format}`);
    }
    
    return strategy;
  }

  /**
   * Gets strategy for a tournament, auto-detecting format if needed
   */
  static getStrategyForTournament(tournament: any): TournamentStrategy {
    const detectedFormat = TournamentFormatDetector.detectFormat(tournament);
    return this.getNewFormatStrategy(detectedFormat);
  }

  static getSupportedFormats(): TournamentFormat[] {
    return Array.from(this.strategies.keys());
  }

  static getSupportedNewFormats(): NewTournamentFormat[] {
    return Array.from(this.newFormatStrategies.keys());
  }

  static registerStrategy(format: TournamentFormat, strategy: TournamentStrategy): void {
    this.strategies.set(format, strategy);
  }

  static registerNewFormatStrategy(format: NewTournamentFormat, strategy: TournamentStrategy): void {
    this.newFormatStrategies.set(format, strategy);
  }
}

// Convenience functions for getting strategy
export function getStrategyForFormat(format: TournamentFormat): TournamentStrategy {
  return TournamentStrategyFactory.getStrategy(format);
}

export function getStrategyForNewFormat(format: NewTournamentFormat): TournamentStrategy {
  return TournamentStrategyFactory.getNewFormatStrategy(format);
}

export function getStrategyForTournament(tournament: any): TournamentStrategy {
  return TournamentStrategyFactory.getStrategyForTournament(tournament);
}