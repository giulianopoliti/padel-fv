import { getTournamentFormatPreset } from '@/config/tournament-format-presets'
import type {
  GoldSilverAdvancementConfig,
  SingleBracketAdvancementConfig,
  TournamentFormatConfigV2,
  TournamentFormatPresetId,
} from '@/types/tournament-format-v2'

export type TournamentFormatBuilderInput = {
  presetId: TournamentFormatPresetId
  singleAdvanceCount?: number | null
  goldCount?: number | null
  silverCount?: number | null
  eliminatedCount?: number | null
}

export function buildTournamentFormatConfig(
  input: TournamentFormatBuilderInput
): TournamentFormatConfigV2 {
  const config = getTournamentFormatPreset(input.presetId)

  if (config.advancementConfig.kind === 'SINGLE') {
    const nextAdvanceCount = input.singleAdvanceCount ?? config.advancementConfig.advanceCount
    ;(config.advancementConfig as SingleBracketAdvancementConfig).advanceCount = nextAdvanceCount
  }

  if (config.advancementConfig.kind === 'GOLD_SILVER') {
    const goldSilverConfig = config.advancementConfig as GoldSilverAdvancementConfig
    goldSilverConfig.goldCount = input.goldCount ?? goldSilverConfig.goldCount
    goldSilverConfig.silverCount = input.silverCount ?? goldSilverConfig.silverCount
    goldSilverConfig.eliminatedCount = input.eliminatedCount ?? goldSilverConfig.eliminatedCount
  }

  return config
}

