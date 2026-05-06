/**
 * RANKING SYSTEM MAIN EXPORTS
 * 
 * ⚠️  CRITICAL: This exports the complete configurable ranking system
 * ⚠️  ZERO IMPACT: Does not affect existing American tournament system
 * 
 * Purpose: Centralized exports for the entire ranking system
 */

// 🏛️ Core Interfaces
export type { 
  StatsDataProvider,
  ExtendedCoupleStats,
  SetData 
} from './interfaces/stats-data-provider.interface'

export type { 
  ConfigurableRankingService,
  ZoneRankingContext,
  UpdateResult 
} from './interfaces/configurable-ranking.interface'

export type { 
  RankingConfiguration,
  RankingCriterion 
} from './types/ranking-configuration.types'

// 📊 Data Providers
export { 
  AmericanTournamentStatsProvider,
  LongTournamentStatsProvider,
  AmericanOTPStatsProvider,
  DefaultStatsDataProviderFactory
} from './providers'

// ⚙️ Ranking Engine
export { 
  ConfigurableRankingEngine 
} from './engines'

export type { 
  TiebreakResult,
  ConfigurableRankingResult 
} from './engines'

// 🔧 Services
export { 
  ConfigurableRankingService 
} from './services'

export type { 
  ZonePositionRecord 
} from './services'

// 🎯 Utilities
export { 
  getRankingSystemType,
  shouldUseLegacySystem 
} from './utils'

// 🚀 High-level Zone Position Functions (Main API)
export { 
  updateZonePositionsForTournament,
  previewZonePositionsForTournament,
  getCurrentZonePositionsForTournament
} from '../zone-position/tournament-zone-dispatcher'

export type { 
  ZoneUpdateResult 
} from '../zone-position/tournament-zone-dispatcher'

// 🎪 LONG Tournament Specific Functions
export { 
  recalculateZonePositions,
  previewZonePositions,
  getCurrentZonePositions
} from '../zone-position/long-tournament-zone-service'

export type { 
  RecalculationResult 
} from '../zone-position/long-tournament-zone-service'