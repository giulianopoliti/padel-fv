import { TournamentFormatResolver } from '@/lib/services/tournament-format-resolver'
import type {
  AdvancementResult,
  BracketKey,
  GoldSilverAdvancementConfig,
  ResolvedTournamentFormat,
  TournamentFormatConfigV2,
} from '@/types/tournament-format-v2'

export class AdvancementPlanner {
  static validateAdvancementCounts(
    totalCouples: number,
    config: TournamentFormatConfigV2
  ): { isValid: boolean; error?: string } {
    const resolved = TournamentFormatResolver.getResolvedFormat({ format_config: config }, { totalCouples })

    if (resolved.effectiveBracketMode === 'GOLD_SILVER') {
      const goldSilverConfig = resolved.effectiveAdvancementConfig as GoldSilverAdvancementConfig
      const sum = goldSilverConfig.goldCount + goldSilverConfig.silverCount + goldSilverConfig.eliminatedCount
      if (sum !== totalCouples) {
        return {
          isValid: false,
          error: `La suma Oro + Plata + Eliminadas debe ser ${totalCouples}. Recibido: ${sum}.`,
        }
      }
    }

    if (resolved.effectiveBracketMode === 'SINGLE' && resolved.effectiveAdvancementConfig.kind === 'SINGLE') {
      if (resolved.baseType === 'AMERICAN' && resolved.zoneMode === 'SINGLE_ZONE' && totalCouples < 4) {
        return {
          isValid: false,
          error: 'El formato americano de zona unica con llave necesita al menos 4 parejas para generar una llave justa.',
        }
      }

      if (resolved.effectiveAdvancementConfig.advanceCount < 2) {
        return {
          isValid: false,
          error: 'La llave unica necesita al menos 2 parejas clasificadas.',
        }
      }
    }

    return { isValid: true }
  }

  static splitRankedEntries<T>(
    rankedEntries: T[],
    config: TournamentFormatConfigV2,
    options: { totalCouples?: number } = {}
  ): AdvancementResult<T> {
    const totalCouples = options.totalCouples ?? rankedEntries.length
    const resolved = TournamentFormatResolver.getResolvedFormat({ format_config: config }, { totalCouples })

    if (resolved.effectiveBracketMode === 'NONE') {
      return {
        gold: [],
        silver: [],
        eliminated: rankedEntries.slice(1),
        championCoupleId: rankedEntries[0],
      }
    }

    if (resolved.effectiveBracketMode === 'SINGLE' && resolved.effectiveAdvancementConfig.kind === 'SINGLE') {
      let advanceCount = resolved.effectiveAdvancementConfig.advanceCount

      if (resolved.baseType === 'AMERICAN' && resolved.zoneMode === 'SINGLE_ZONE' && totalCouples === 5) {
        advanceCount = 4
      }

      return {
        gold: rankedEntries.slice(0, advanceCount),
        silver: [],
        eliminated: rankedEntries.slice(advanceCount),
      }
    }

    const goldSilverConfig = resolved.effectiveAdvancementConfig as GoldSilverAdvancementConfig

    return {
      gold: rankedEntries.slice(0, goldSilverConfig.goldCount),
      silver: rankedEntries.slice(goldSilverConfig.goldCount, goldSilverConfig.goldCount + goldSilverConfig.silverCount),
      eliminated: rankedEntries.slice(goldSilverConfig.goldCount + goldSilverConfig.silverCount),
    }
  }

  static selectBracketEntries<T>(
    rankedEntries: T[],
    config: TournamentFormatConfigV2,
    bracketKey: BracketKey = 'MAIN',
    options: { totalCouples?: number } = {}
  ): T[] {
    const groups = this.splitRankedEntries(rankedEntries, config, options)
    if (bracketKey === 'GOLD' || bracketKey === 'MAIN') {
      return groups.gold
    }
    return groups.silver
  }

  static getBracketLabel(bracketKey: BracketKey): string {
    switch (bracketKey) {
      case 'GOLD':
        return 'Copa de Oro'
      case 'SILVER':
        return 'Copa de Plata'
      default:
        return 'Llave Principal'
    }
  }
}
