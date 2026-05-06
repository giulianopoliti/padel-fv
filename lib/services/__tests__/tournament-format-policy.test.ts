import { getTournamentFormatPreset } from '@/config/tournament-format-presets'
import {
  canSwitchAmericanMultiZoneRuntime,
  hasFormatConfigV2,
  isFormatStatusAllowedForRuntimeSwitch,
  isRuntimeAmericanMultiZonePreset,
  shouldUseLegacyQualifying,
  shouldWrapLegacyEndpointsWithCanonicalFlow,
} from '@/lib/services/tournament-format-policy'

describe('tournament-format-policy', () => {
  it('treats tournaments with v2 format config as non-legacy for qualifying settings', () => {
    const tournament = {
      type: 'AMERICAN',
      format_config: getTournamentFormatPreset('AMERICAN_MULTI_ZONE_2'),
    }

    expect(hasFormatConfigV2(tournament)).toBe(true)
    expect(shouldUseLegacyQualifying(tournament)).toBe(false)
  })

  it('treats tournaments without v2 format config as legacy for qualifying settings', () => {
    const tournament = {
      type: 'LONG',
      format_type: 'LONG',
      format_config: null,
    }

    expect(hasFormatConfigV2(tournament)).toBe(false)
    expect(shouldUseLegacyQualifying(tournament)).toBe(true)
  })

  it('wraps legacy endpoints for AMERICAN_MULTI_ZONE_2 and AMERICAN_MULTI_ZONE_3 in v2', () => {
    const wrappedMZ2 = {
      type: 'AMERICAN',
      format_config: getTournamentFormatPreset('AMERICAN_MULTI_ZONE_2'),
    }

    const wrappedMZ3 = {
      type: 'AMERICAN',
      format_config: getTournamentFormatPreset('AMERICAN_MULTI_ZONE_3'),
    }

    expect(shouldWrapLegacyEndpointsWithCanonicalFlow(wrappedMZ2)).toBe(true)
    expect(shouldWrapLegacyEndpointsWithCanonicalFlow(wrappedMZ3)).toBe(true)
    expect(shouldWrapLegacyEndpointsWithCanonicalFlow({ type: 'AMERICAN', format_config: null })).toBe(false)
  })

  it('allows runtime switches only between MZ2 and MZ3 presets', () => {
    expect(isRuntimeAmericanMultiZonePreset('AMERICAN_MULTI_ZONE_2')).toBe(true)
    expect(isRuntimeAmericanMultiZonePreset('AMERICAN_MULTI_ZONE_3')).toBe(true)
    expect(isRuntimeAmericanMultiZonePreset('AMERICAN_SINGLE_ZONE_2_BRACKET')).toBe(false)

    expect(
      canSwitchAmericanMultiZoneRuntime('AMERICAN_MULTI_ZONE_2', 'AMERICAN_MULTI_ZONE_3')
    ).toBe(true)
    expect(
      canSwitchAmericanMultiZoneRuntime('AMERICAN_MULTI_ZONE_3', 'AMERICAN_MULTI_ZONE_2')
    ).toBe(true)
    expect(
      canSwitchAmericanMultiZoneRuntime('AMERICAN_MULTI_ZONE_2', 'AMERICAN_MULTI_ZONE_2')
    ).toBe(true)
    expect(
      canSwitchAmericanMultiZoneRuntime('AMERICAN_MULTI_ZONE_2', 'AMERICAN_SINGLE_ZONE_2_BRACKET')
    ).toBe(false)
  })

  it('allows runtime switch only in NOT_STARTED and ZONE_PHASE', () => {
    expect(isFormatStatusAllowedForRuntimeSwitch('NOT_STARTED')).toBe(true)
    expect(isFormatStatusAllowedForRuntimeSwitch('ZONE_PHASE')).toBe(true)
    expect(isFormatStatusAllowedForRuntimeSwitch('BRACKET_PHASE')).toBe(false)
    expect(isFormatStatusAllowedForRuntimeSwitch('CANCELED')).toBe(false)
  })
})
