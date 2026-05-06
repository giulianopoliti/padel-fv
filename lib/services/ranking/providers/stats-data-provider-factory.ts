/**
 * STATS DATA PROVIDER FACTORY
 * 
 * ⚠️  CRITICAL: This factory maintains 100% backward compatibility
 * ⚠️  AMERICAN tournaments get wrapped provider that delegates to existing code
 * 
 * Purpose: Create appropriate data providers based on tournament.type
 */

import type { StatsDataProvider, StatsDataProviderFactory } from '../interfaces/stats-data-provider.interface'
import { 
  AmericanTournamentStatsProvider,
  LongTournamentStatsProvider,
  AmericanOTPStatsProvider
} from './index'
import { 
  isLegacyTournamentType, 
  isConfigurableTournamentType 
} from '../interfaces'

/**
 * Factory implementation for creating stats data providers
 */
export class DefaultStatsDataProviderFactory implements StatsDataProviderFactory {
  private providers: Map<string, () => StatsDataProvider>
  
  constructor() {
    this.providers = new Map([
      // ✅ AMERICAN: Wraps existing ZoneStatsCalculator (zero breaking changes)
      ['AMERICAN', () => new AmericanTournamentStatsProvider()],
      
      // 🆕 LONG: New provider for 3-set tournaments
      ['LONG', () => new LongTournamentStatsProvider()],
      
      // 🆕 AMERICAN_OTP: New provider for single-zone American tournaments
      ['AMERICAN_OTP', () => new AmericanOTPStatsProvider()]
    ])
  }
  
  /**
   * Create a data provider for the specified tournament type
   */
  createProvider(tournamentType: string): StatsDataProvider | null {
    const providerFactory = this.providers.get(tournamentType)
    
    if (!providerFactory) {
      console.warn(`No stats data provider found for tournament type: ${tournamentType}`)
      return null
    }
    
    return providerFactory()
  }
  
  /**
   * Check if a tournament type supports configurable ranking
   * AMERICAN = false (uses legacy hardcoded system)
   * LONG, AMERICAN_OTP = true (uses configurable system)
   */
  supportsConfigurableRanking(tournamentType: string): boolean {
    return isConfigurableTournamentType(tournamentType)
  }
  
  /**
   * Register a new data provider for a tournament type
   */
  registerProvider(tournamentType: string, provider: StatsDataProvider): void {
    this.providers.set(tournamentType, () => provider)
  }
  
  /**
   * Get all supported tournament types
   */
  getSupportedTypes(): string[] {
    return Array.from(this.providers.keys())
  }
  
  /**
   * Get tournament types that use legacy system
   */
  getLegacyTypes(): string[] {
    return this.getSupportedTypes().filter(type => isLegacyTournamentType(type))
  }
  
  /**
   * Get tournament types that use configurable system
   */
  getConfigurableTypes(): string[] {
    return this.getSupportedTypes().filter(type => isConfigurableTournamentType(type))
  }
  
  /**
   * Check if a tournament type is supported
   */
  isSupported(tournamentType: string): boolean {
    return this.providers.has(tournamentType)
  }
  
  /**
   * Get provider information for debugging
   */
  getProviderInfo(tournamentType: string): {
    supported: boolean
    usesConfigurableRanking: boolean
    providerClass: string
    dataInterpretation?: {
      resultRepresents: string
      setsPerMatch: number | string
      gamesSource: string
    }
  } {
    const supported = this.isSupported(tournamentType)
    
    if (!supported) {
      return {
        supported: false,
        usesConfigurableRanking: false,
        providerClass: 'None'
      }
    }
    
    const provider = this.createProvider(tournamentType)
    const usesConfigurableRanking = this.supportsConfigurableRanking(tournamentType)
    
    // Get data interpretation info if provider is available
    let dataInterpretation
    if (provider && 'getDataInterpretation' in provider) {
      const interpretation = (provider as any).getDataInterpretation()
      dataInterpretation = {
        resultRepresents: interpretation.resultCouple1Represents,
        setsPerMatch: interpretation.setsPerMatch,
        gamesSource: interpretation.gamesSource
      }
    }
    
    return {
      supported: true,
      usesConfigurableRanking,
      providerClass: provider?.constructor.name || 'Unknown',
      dataInterpretation
    }
  }
}

/**
 * Singleton instance for global use
 */
export const statsDataProviderFactory = new DefaultStatsDataProviderFactory()

/**
 * Convenience function to create a provider
 */
export function createStatsDataProvider(tournamentType: string): StatsDataProvider | null {
  return statsDataProviderFactory.createProvider(tournamentType)
}

/**
 * Convenience function to check configurable ranking support
 */
export function supportsConfigurableRanking(tournamentType: string): boolean {
  return statsDataProviderFactory.supportsConfigurableRanking(tournamentType)
}