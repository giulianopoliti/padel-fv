import type {
  OperationalTournamentFormatPresetId,
  TournamentFormatConfigV2,
  TournamentFormatPresetId,
} from '@/types/tournament-format-v2'

export const TOURNAMENT_FORMAT_PRESETS: Record<OperationalTournamentFormatPresetId, TournamentFormatConfigV2> = {
  AMERICAN_MULTI_ZONE_2: {
    version: 2,
    presetId: 'AMERICAN_MULTI_ZONE_2',
    baseType: 'AMERICAN',
    zoneMode: 'MULTI_ZONE',
    zoneStage: 'FIXED_MATCH_COUNT',
    targetMatchesPerCouple: 2,
    bracketMode: 'SINGLE',
    advancementConfig: { kind: 'PER_ZONE_TOP', couplesPerZone: 'ALL' },
    rankingScope: 'PER_ZONE',
    rankingPolicyId: 'STANDARD_PADEL',
    qualificationSource: 'ZONE_POSITIONS',
    bracketSeedingStrategy: 'SERPENTINE_BY_ZONE',
    zoneRules: {
      minSize: 3,
      maxSize: 5,
      idealSize: 4,
      allowedSizes: [3, 4, 5],
    },
    display: {
      name: 'Americano por zonas (2 partidos)',
      description: 'Zonas multiples con 2 partidos por pareja y llave unica configurable por zona.',
    },
  },
  AMERICAN_MULTI_ZONE_3: {
    version: 2,
    presetId: 'AMERICAN_MULTI_ZONE_3',
    baseType: 'AMERICAN',
    zoneMode: 'MULTI_ZONE',
    zoneStage: 'FIXED_MATCH_COUNT',
    targetMatchesPerCouple: 3,
    bracketMode: 'SINGLE',
    advancementConfig: { kind: 'PER_ZONE_TOP', couplesPerZone: 'ALL' },
    rankingScope: 'PER_ZONE',
    rankingPolicyId: 'STANDARD_PADEL',
    qualificationSource: 'ZONE_POSITIONS',
    bracketSeedingStrategy: 'SERPENTINE_BY_ZONE',
    zoneRules: {
      minSize: 3,
      maxSize: 4,
      idealSize: 4,
      allowedSizes: [3, 4],
    },
    display: {
      name: 'Americano por zonas (3 partidos)',
      description: 'Zonas multiples: zonas de 4 juegan 3 partidos por pareja; zonas de 3 juegan round robin completo.',
    },
  },
  AMERICAN_MULTI_ZONE_GLOBAL_2: {
    version: 2,
    presetId: 'AMERICAN_MULTI_ZONE_GLOBAL_2',
    baseType: 'AMERICAN',
    zoneMode: 'MULTI_ZONE',
    zoneStage: 'FIXED_MATCH_COUNT',
    targetMatchesPerCouple: 2,
    bracketMode: 'SINGLE',
    advancementConfig: { kind: 'SINGLE', advanceCount: 64 },
    rankingScope: 'GLOBAL',
    rankingPolicyId: 'STANDARD_PADEL',
    qualificationSource: 'GLOBAL_STANDINGS',
    bracketSeedingStrategy: 'GLOBAL_RANKING',
    zoneRules: {
      minSize: 3,
      maxSize: 5,
      idealSize: 4,
      allowedSizes: [3, 4, 5],
    },
    display: {
      name: 'Americano tabla general (2 partidos)',
      description: 'Zonas multiples con 2 partidos por pareja y llave sembrada desde una tabla general.',
    },
  },
  AMERICAN_MULTI_ZONE_GLOBAL_3: {
    version: 2,
    presetId: 'AMERICAN_MULTI_ZONE_GLOBAL_3',
    baseType: 'AMERICAN',
    zoneMode: 'MULTI_ZONE',
    zoneStage: 'FIXED_MATCH_COUNT',
    targetMatchesPerCouple: 3,
    bracketMode: 'SINGLE',
    advancementConfig: { kind: 'SINGLE', advanceCount: 64 },
    rankingScope: 'GLOBAL',
    rankingPolicyId: 'STANDARD_PADEL',
    qualificationSource: 'GLOBAL_STANDINGS',
    bracketSeedingStrategy: 'GLOBAL_RANKING',
    zoneRules: {
      minSize: 3,
      maxSize: 4,
      idealSize: 4,
      allowedSizes: [3, 4],
    },
    display: {
      name: 'Americano tabla general (3 partidos)',
      description: 'Zonas multiples: zonas de 4 juegan 3 partidos por pareja; la llave sale de la tabla general.',
    },
  },
  AMERICAN_SINGLE_ZONE_ROUND_ROBIN_CHAMPION: {
    version: 2,
    presetId: 'AMERICAN_SINGLE_ZONE_ROUND_ROBIN_CHAMPION',
    baseType: 'AMERICAN',
    zoneMode: 'SINGLE_ZONE',
    zoneStage: 'ROUND_ROBIN',
    targetMatchesPerCouple: null,
    bracketMode: 'NONE',
    advancementConfig: { kind: 'NONE' },
    rankingScope: 'PER_ZONE',
    rankingPolicyId: 'STANDARD_PADEL',
    qualificationSource: 'ZONE_POSITIONS',
    bracketSeedingStrategy: 'SERPENTINE_BY_ZONE',
    zoneRules: {
      minSize: 3,
      maxSize: 16,
      idealSize: 5,
      allowedSizes: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    },
    display: {
      name: 'Americano zona unica (todos contra todos)',
      description: 'Todos contra todos; el primero de la tabla es campeon.',
    },
  },
  LONG_SINGLE_ZONE_BRACKET: {
    version: 2,
    presetId: 'LONG_SINGLE_ZONE_BRACKET',
    baseType: 'LONG',
    zoneMode: 'SINGLE_ZONE',
    zoneStage: 'FIXED_MATCH_COUNT',
    targetMatchesPerCouple: 3,
    bracketMode: 'SINGLE',
    advancementConfig: { kind: 'SINGLE', advanceCount: 8 },
    rankingScope: 'PER_ZONE',
    rankingPolicyId: 'STANDARD_PADEL',
    qualificationSource: 'ZONE_POSITIONS',
    bracketSeedingStrategy: 'SERPENTINE_BY_ZONE',
    zoneRules: {
      minSize: 4,
      maxSize: 32,
      idealSize: 8,
      allowedSizes: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32],
    },
    display: {
      name: 'Long zona unica + llave',
      description: 'Zona unica con cantidad configurable de partidos por pareja y luego llave unica.',
    },
  },
  LONG_SINGLE_ZONE_GOLD_SILVER: {
    version: 2,
    presetId: 'LONG_SINGLE_ZONE_GOLD_SILVER',
    baseType: 'LONG',
    zoneMode: 'SINGLE_ZONE',
    zoneStage: 'FIXED_MATCH_COUNT',
    targetMatchesPerCouple: 3,
    bracketMode: 'GOLD_SILVER',
    advancementConfig: { kind: 'GOLD_SILVER', goldCount: 4, silverCount: 4, eliminatedCount: 0 },
    rankingScope: 'PER_ZONE',
    rankingPolicyId: 'STANDARD_PADEL',
    qualificationSource: 'ZONE_POSITIONS',
    bracketSeedingStrategy: 'SERPENTINE_BY_ZONE',
    zoneRules: {
      minSize: 4,
      maxSize: 32,
      idealSize: 8,
      allowedSizes: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32],
    },
    display: {
      name: 'Long zona unica (Oro y Plata)',
      description: 'Zona unica con cantidad configurable de partidos por pareja y luego Copa de Oro y Copa de Plata.',
    },
  },
}

const LEGACY_PRESET_REDIRECTS: Record<Exclude<TournamentFormatPresetId, OperationalTournamentFormatPresetId>, OperationalTournamentFormatPresetId> = {
  AMERICAN_MULTI_ZONE_GLOBAL_STANDINGS: 'AMERICAN_MULTI_ZONE_GLOBAL_3',
  AMERICAN_SINGLE_ZONE_2_BRACKET: 'AMERICAN_SINGLE_ZONE_ROUND_ROBIN_CHAMPION',
  AMERICAN_SINGLE_ZONE_3_BRACKET: 'AMERICAN_SINGLE_ZONE_ROUND_ROBIN_CHAMPION',
  AMERICAN_SINGLE_ZONE_ROUND_ROBIN_GOLD_SILVER: 'AMERICAN_SINGLE_ZONE_ROUND_ROBIN_CHAMPION',
  LONG_SINGLE_ZONE_CHAMPION: 'LONG_SINGLE_ZONE_BRACKET',
}

export function getTournamentFormatPreset(presetId: TournamentFormatPresetId): TournamentFormatConfigV2 {
  const operationalPresetId = presetId in TOURNAMENT_FORMAT_PRESETS
    ? presetId as OperationalTournamentFormatPresetId
    : LEGACY_PRESET_REDIRECTS[presetId as Exclude<TournamentFormatPresetId, OperationalTournamentFormatPresetId>]

  return structuredClone(TOURNAMENT_FORMAT_PRESETS[operationalPresetId])
}

export function getPresetOptionsByType(type: 'AMERICAN' | 'LONG'): TournamentFormatConfigV2[] {
  return Object.values(TOURNAMENT_FORMAT_PRESETS).filter((preset) => preset.baseType === type)
}
