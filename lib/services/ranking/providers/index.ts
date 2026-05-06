/**
 * STATS DATA PROVIDERS INDEX
 * 
 * ⚠️  CRITICAL: These providers maintain 100% backward compatibility
 * ⚠️  AMERICAN tournaments continue using existing ZoneStatsCalculator via wrapper
 * 
 * Tournament Type → Provider Mapping:
 * - AMERICAN → AmericanTournamentStatsProvider (wraps existing code)
 * - LONG → LongTournamentStatsProvider (new 3-set logic)
 * - AMERICAN_OTP → AmericanOTPStatsProvider (single zone configurable)
 */

// Base provider
export { BaseStatsDataProvider } from './base-stats-data-provider'
export type { DataInterpretation } from './base-stats-data-provider'

// Tournament-specific providers
export { AmericanTournamentStatsProvider } from './american-tournament-stats.provider'
export { LongTournamentStatsProvider } from './long-tournament-stats.provider'
export { AmericanOTPStatsProvider } from './american-otp-stats.provider'

// Factory
export { DefaultStatsDataProviderFactory } from './stats-data-provider-factory'

// Re-export interfaces for convenience
export type {
  StatsDataProvider,
  StatsDataProviderFactory,
  ExtendedCoupleStats,
  SetData,
  GameData
} from '../interfaces/stats-data-provider.interface'