import type {
  TournamentFormatConfigV2,
  TournamentFormatPresetId,
} from '@/types/tournament-format-v2'

export const TOURNAMENT_FORMAT_PRESETS: Record<TournamentFormatPresetId, TournamentFormatConfigV2> = {
  AMERICAN_MULTI_ZONE_2: {
    version: 2,
    presetId: 'AMERICAN_MULTI_ZONE_2',
    baseType: 'AMERICAN',
    zoneMode: 'MULTI_ZONE',
    zoneStage: 'FIXED_MATCH_COUNT',
    targetMatchesPerCouple: 2,
    bracketMode: 'SINGLE',
    advancementConfig: { kind: 'SINGLE', advanceCount: 8 },
    zoneRules: {
      minSize: 3,
      maxSize: 5,
      idealSize: 4,
      allowedSizes: [3, 4, 5],
    },
    display: {
      name: 'Americano por zonas (2 partidos)',
      description: 'Zonas multiples con 2 partidos por pareja y luego llave unica.',
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
    advancementConfig: { kind: 'SINGLE', advanceCount: 8 },
    zoneRules: {
      minSize: 3,
      maxSize: 4,
      idealSize: 4,
      allowedSizes: [3, 4],
    },
    display: {
      name: 'Americano por zonas (3 partidos)',
      description: 'Zonas multiples; las de 3 juegan 2 partidos y las de 4 juegan 3.',
    },
  },
  AMERICAN_SINGLE_ZONE_2_BRACKET: {
    version: 2,
    presetId: 'AMERICAN_SINGLE_ZONE_2_BRACKET',
    baseType: 'AMERICAN',
    zoneMode: 'SINGLE_ZONE',
    zoneStage: 'FIXED_MATCH_COUNT',
    targetMatchesPerCouple: 2,
    bracketMode: 'SINGLE',
    advancementConfig: { kind: 'SINGLE', advanceCount: 4 },
    zoneRules: {
      minSize: 3,
      maxSize: 5,
      idealSize: 4,
      allowedSizes: [3, 4, 5],
    },
    display: {
      name: 'Americano zona unica (2 partidos + llave)',
      description: 'Zona unica con 2 partidos por pareja y luego llave unica.',
    },
  },
  AMERICAN_SINGLE_ZONE_3_BRACKET: {
    version: 2,
    presetId: 'AMERICAN_SINGLE_ZONE_3_BRACKET',
    baseType: 'AMERICAN',
    zoneMode: 'SINGLE_ZONE',
    zoneStage: 'FIXED_MATCH_COUNT',
    targetMatchesPerCouple: 3,
    bracketMode: 'SINGLE',
    advancementConfig: { kind: 'SINGLE', advanceCount: 4 },
    zoneRules: {
      minSize: 3,
      maxSize: 5,
      idealSize: 4,
      allowedSizes: [3, 4, 5],
    },
    display: {
      name: 'Americano zona unica (3 partidos + llave)',
      description: 'Zona unica con 3 partidos por pareja y luego llave unica.',
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
  AMERICAN_SINGLE_ZONE_ROUND_ROBIN_GOLD_SILVER: {
    version: 2,
    presetId: 'AMERICAN_SINGLE_ZONE_ROUND_ROBIN_GOLD_SILVER',
    baseType: 'AMERICAN',
    zoneMode: 'SINGLE_ZONE',
    zoneStage: 'ROUND_ROBIN',
    targetMatchesPerCouple: null,
    bracketMode: 'GOLD_SILVER',
    advancementConfig: { kind: 'GOLD_SILVER', goldCount: 4, silverCount: 4, eliminatedCount: 0 },
    zoneRules: {
      minSize: 4,
      maxSize: 16,
      idealSize: 8,
      allowedSizes: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    },
    display: {
      name: 'Americano zona unica (Oro y Plata)',
      description: 'Todos contra todos y luego Copa de Oro y Copa de Plata.',
    },
  },
  LONG_SINGLE_ZONE_BRACKET: {
    version: 2,
    presetId: 'LONG_SINGLE_ZONE_BRACKET',
    baseType: 'LONG',
    zoneMode: 'SINGLE_ZONE',
    zoneStage: 'ROUND_ROBIN',
    targetMatchesPerCouple: null,
    bracketMode: 'SINGLE',
    advancementConfig: { kind: 'SINGLE', advanceCount: 8 },
    zoneRules: {
      minSize: 4,
      maxSize: 32,
      idealSize: 8,
      allowedSizes: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32],
    },
    display: {
      name: 'Long zona unica + llave',
      description: 'Zona unica todos contra todos y luego llave unica.',
    },
  },
  LONG_SINGLE_ZONE_CHAMPION: {
    version: 2,
    presetId: 'LONG_SINGLE_ZONE_CHAMPION',
    baseType: 'LONG',
    zoneMode: 'SINGLE_ZONE',
    zoneStage: 'ROUND_ROBIN',
    targetMatchesPerCouple: null,
    bracketMode: 'NONE',
    advancementConfig: { kind: 'NONE' },
    zoneRules: {
      minSize: 4,
      maxSize: 32,
      idealSize: 8,
      allowedSizes: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32],
    },
    display: {
      name: 'Long zona unica (campeon directo)',
      description: 'Todos contra todos; la tabla final define al campeon.',
    },
  },
  LONG_SINGLE_ZONE_GOLD_SILVER: {
    version: 2,
    presetId: 'LONG_SINGLE_ZONE_GOLD_SILVER',
    baseType: 'LONG',
    zoneMode: 'SINGLE_ZONE',
    zoneStage: 'ROUND_ROBIN',
    targetMatchesPerCouple: null,
    bracketMode: 'GOLD_SILVER',
    advancementConfig: { kind: 'GOLD_SILVER', goldCount: 4, silverCount: 4, eliminatedCount: 0 },
    zoneRules: {
      minSize: 4,
      maxSize: 32,
      idealSize: 8,
      allowedSizes: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32],
    },
    display: {
      name: 'Long zona unica (Oro y Plata)',
      description: 'Todos contra todos y luego Copa de Oro y Copa de Plata.',
    },
  },
}

export function getTournamentFormatPreset(presetId: TournamentFormatPresetId): TournamentFormatConfigV2 {
  return structuredClone(TOURNAMENT_FORMAT_PRESETS[presetId])
}

export function getPresetOptionsByType(type: 'AMERICAN' | 'LONG'): TournamentFormatConfigV2[] {
  return Object.values(TOURNAMENT_FORMAT_PRESETS).filter((preset) => preset.baseType === type)
}
