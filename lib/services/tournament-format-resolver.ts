import { getTournamentFormatPreset } from '@/config/tournament-format-presets'
import type {
  AdvancementConfig,
  ResolvedTournamentFormat,
  TournamentFormatConfigV2,
  TournamentFormatPresetId,
} from '@/types/tournament-format-v2'

type TournamentLike = {
  type?: string | null
  format_type?: string | null
  format_config?: unknown
}

function isAdvancementConfig(value: any): value is AdvancementConfig {
  return value && typeof value === 'object' && typeof value.kind === 'string'
}

function isTournamentFormatConfigV2(value: any): value is TournamentFormatConfigV2 {
  return (
    value &&
    typeof value === 'object' &&
    value.version === 2 &&
    typeof value.presetId === 'string' &&
    typeof value.baseType === 'string' &&
    typeof value.zoneMode === 'string' &&
    typeof value.zoneStage === 'string' &&
    typeof value.bracketMode === 'string' &&
    isAdvancementConfig(value.advancementConfig)
  )
}

function getLegacyPresetId(tournament: TournamentLike): TournamentFormatPresetId {
  if (tournament.type === 'LONG') {
    return 'LONG_SINGLE_ZONE_BRACKET'
  }

  if (tournament.type === 'AMERICAN_OTP' || tournament.type === 'AMERICANO') {
    return 'AMERICAN_SINGLE_ZONE_ROUND_ROBIN_CHAMPION'
  }

  if (tournament.format_type === 'AMERICAN_3') {
    return 'AMERICAN_MULTI_ZONE_3'
  }

  return 'AMERICAN_MULTI_ZONE_2'
}

export class TournamentFormatResolver {
  static getResolvedFormat(
    tournament: TournamentLike,
    options: {
      totalCouples?: number
    } = {}
  ): ResolvedTournamentFormat {
    const rawConfig = tournament.format_config
    const baseConfig = isTournamentFormatConfigV2(rawConfig)
      ? structuredClone(rawConfig)
      : getTournamentFormatPreset(getLegacyPresetId(tournament))

    const notes: string[] = []
    let effectiveZoneStage = baseConfig.zoneStage
    let effectiveTargetMatchesPerCouple = baseConfig.targetMatchesPerCouple
    let effectiveBracketMode = baseConfig.bracketMode
    let effectiveAdvancementConfig = structuredClone(baseConfig.advancementConfig)

    const totalCouples = options.totalCouples

    if (
      baseConfig.baseType === 'AMERICAN' &&
      baseConfig.zoneMode === 'SINGLE_ZONE' &&
      effectiveBracketMode === 'SINGLE' &&
      totalCouples === 5
    ) {
      effectiveZoneStage = 'ROUND_ROBIN'
      effectiveTargetMatchesPerCouple = 4
      if (effectiveAdvancementConfig.kind === 'SINGLE') {
        effectiveAdvancementConfig.advanceCount = 4
      }
      notes.push('Zona unica de 5 parejas: se aplica round robin completo y top 4 a semifinales.')
    }

    if (
      baseConfig.baseType === 'AMERICAN' &&
      baseConfig.zoneMode === 'MULTI_ZONE' &&
      baseConfig.targetMatchesPerCouple === 3
    ) {
      notes.push('Las zonas de 3 parejas juegan 2 partidos por pareja por excepcion del formato.')
    }

    return {
      ...baseConfig,
      effectiveZoneStage,
      effectiveTargetMatchesPerCouple,
      effectiveBracketMode,
      effectiveAdvancementConfig,
      appliedNotes: notes,
    }
  }
}
