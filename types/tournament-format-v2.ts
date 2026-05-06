export type BaseTournamentType = 'AMERICAN' | 'LONG'

export type TournamentFormatPresetId =
  | 'AMERICAN_MULTI_ZONE_2'
  | 'AMERICAN_MULTI_ZONE_3'
  | 'AMERICAN_SINGLE_ZONE_2_BRACKET'
  | 'AMERICAN_SINGLE_ZONE_3_BRACKET'
  | 'AMERICAN_SINGLE_ZONE_ROUND_ROBIN_CHAMPION'
  | 'AMERICAN_SINGLE_ZONE_ROUND_ROBIN_GOLD_SILVER'
  | 'LONG_SINGLE_ZONE_BRACKET'
  | 'LONG_SINGLE_ZONE_CHAMPION'
  | 'LONG_SINGLE_ZONE_GOLD_SILVER'

export type ZoneMode = 'MULTI_ZONE' | 'SINGLE_ZONE'
export type ZoneStage = 'FIXED_MATCH_COUNT' | 'ROUND_ROBIN'
export type BracketMode = 'NONE' | 'SINGLE' | 'GOLD_SILVER'
export type BracketKey = 'MAIN' | 'GOLD' | 'SILVER'

export interface SingleBracketAdvancementConfig {
  kind: 'SINGLE'
  advanceCount: number
}

export interface GoldSilverAdvancementConfig {
  kind: 'GOLD_SILVER'
  goldCount: number
  silverCount: number
  eliminatedCount: number
}

export interface NoBracketAdvancementConfig {
  kind: 'NONE'
}

export type AdvancementConfig =
  | SingleBracketAdvancementConfig
  | GoldSilverAdvancementConfig
  | NoBracketAdvancementConfig

export interface TournamentFormatZoneRules {
  minSize: number
  maxSize: number
  idealSize: number
  allowedSizes: number[]
}

export interface TournamentFormatConfigV2 {
  version: 2
  presetId: TournamentFormatPresetId
  baseType: BaseTournamentType
  zoneMode: ZoneMode
  zoneStage: ZoneStage
  targetMatchesPerCouple: 2 | 3 | null
  bracketMode: BracketMode
  advancementConfig: AdvancementConfig
  zoneRules: TournamentFormatZoneRules
  display: {
    name: string
    description: string
  }
}

export interface ResolvedTournamentFormat extends TournamentFormatConfigV2 {
  effectiveZoneStage: ZoneStage
  effectiveTargetMatchesPerCouple: number | null
  effectiveBracketMode: BracketMode
  effectiveAdvancementConfig: AdvancementConfig
  appliedNotes: string[]
}

export interface PlannedZone {
  index: number
  name: string
  size: number
  stage: ZoneStage
  matchesPerCouple: number
  notes: string[]
}

export interface ZoneFixturePlan {
  zoneMode: ZoneMode
  totalCouples: number
  zones: PlannedZone[]
  notes: string[]
  isValid: boolean
  errors: string[]
}

export interface AdvancementResult<T = string> {
  gold: T[]
  silver: T[]
  eliminated: T[]
  championCoupleId?: T
}
