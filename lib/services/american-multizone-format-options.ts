import type { TournamentFormatConfigV2, TournamentFormatPresetId } from '@/types/tournament-format-v2'

export type AmericanMultiZoneAlgorithm = 'SERPENTINE_BY_ZONE' | 'GLOBAL_STANDINGS'
export type AmericanMultiZoneMatchesPerCouple = 2 | 3

export const AMERICAN_MULTI_ZONE_FORMAT_OPTIONS: Array<{
  id: AmericanMultiZoneAlgorithm
  label: string
  description: string
}> = [
  {
    id: 'SERPENTINE_BY_ZONE',
    label: 'Americano multizona serpenteo',
    description: 'Clasifica por posiciones de zona y arma la llave con el orden serpentino historico.',
  },
  {
    id: 'GLOBAL_STANDINGS',
    label: 'Americano multizona tabla general',
    description: 'Clasifica todas las parejas en una tabla general y arma la llave desde ese ranking.',
  },
]

export const AMERICAN_MULTI_ZONE_MATCH_OPTIONS: AmericanMultiZoneMatchesPerCouple[] = [2, 3]

const PRESET_BY_SELECTION: Record<
  AmericanMultiZoneAlgorithm,
  Record<AmericanMultiZoneMatchesPerCouple, TournamentFormatPresetId>
> = {
  SERPENTINE_BY_ZONE: {
    2: 'AMERICAN_MULTI_ZONE_2',
    3: 'AMERICAN_MULTI_ZONE_3',
  },
  GLOBAL_STANDINGS: {
    2: 'AMERICAN_MULTI_ZONE_GLOBAL_2',
    3: 'AMERICAN_MULTI_ZONE_GLOBAL_3',
  },
}

export function isAmericanMultiZonePresetId(presetId?: string | null): boolean {
  return (
    presetId === 'AMERICAN_MULTI_ZONE_2' ||
    presetId === 'AMERICAN_MULTI_ZONE_3' ||
    presetId === 'AMERICAN_MULTI_ZONE_GLOBAL_2' ||
    presetId === 'AMERICAN_MULTI_ZONE_GLOBAL_3'
  )
}

export function getAmericanMultiZoneAlgorithmFromPresetId(
  presetId?: string | null
): AmericanMultiZoneAlgorithm {
  if (presetId === 'AMERICAN_MULTI_ZONE_GLOBAL_2' || presetId === 'AMERICAN_MULTI_ZONE_GLOBAL_3') {
    return 'GLOBAL_STANDINGS'
  }

  return 'SERPENTINE_BY_ZONE'
}

export function getAmericanMultiZoneMatchesFromPresetId(
  presetId?: string | null
): AmericanMultiZoneMatchesPerCouple {
  if (presetId === 'AMERICAN_MULTI_ZONE_3' || presetId === 'AMERICAN_MULTI_ZONE_GLOBAL_3') {
    return 3
  }

  return 2
}

export function getAmericanMultiZoneMatchesFromConfig(
  config: Pick<TournamentFormatConfigV2, 'presetId' | 'targetMatchesPerCouple'>
): AmericanMultiZoneMatchesPerCouple {
  if (config.targetMatchesPerCouple === 2) {
    return 2
  }

  if (config.targetMatchesPerCouple === 3) {
    return 3
  }

  return getAmericanMultiZoneMatchesFromPresetId(config.presetId)
}

export function getAmericanMultiZonePresetId(
  algorithm: AmericanMultiZoneAlgorithm,
  matchesPerCouple: AmericanMultiZoneMatchesPerCouple
): TournamentFormatPresetId {
  return PRESET_BY_SELECTION[algorithm][matchesPerCouple]
}
