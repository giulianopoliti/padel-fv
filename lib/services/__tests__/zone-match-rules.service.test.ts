import { getTournamentFormatPreset } from '@/config/tournament-format-presets'
import { ZoneMatchRulesService } from '@/lib/services/zone-match-rules.service'

describe('ZoneMatchRulesService', () => {
  it('resolves AMERICAN_MULTI_ZONE_3 zones of 4 to 3 matches per couple', () => {
    const rules = ZoneMatchRulesService.resolveRules({
      tournament: {
        type: 'AMERICAN',
        format_config: getTournamentFormatPreset('AMERICAN_MULTI_ZONE_3'),
      },
      coupleCount: 4,
    })

    expect(rules.maxMatchesPerCouple).toBe(3)
    expect(rules.source).toBe('tournament.format_config')
  })

  it('resolves AMERICAN_MULTI_ZONE_3 zones of 3 to 2 matches per couple', () => {
    const rules = ZoneMatchRulesService.resolveRules({
      tournament: {
        type: 'AMERICAN',
        format_config: getTournamentFormatPreset('AMERICAN_MULTI_ZONE_3'),
      },
      coupleCount: 3,
    })

    expect(rules.maxMatchesPerCouple).toBe(2)
  })

  it('resolves AMERICAN_MULTI_ZONE_2 zones of 4 to 2 matches per couple', () => {
    const rules = ZoneMatchRulesService.resolveRules({
      tournament: {
        type: 'AMERICAN',
        format_config: getTournamentFormatPreset('AMERICAN_MULTI_ZONE_2'),
      },
      coupleCount: 4,
    })

    expect(rules.maxMatchesPerCouple).toBe(2)
  })

  it('falls back to legacy AMERICAN_3 format_type when format_config is absent', () => {
    const rules = ZoneMatchRulesService.resolveRules({
      tournament: {
        type: 'AMERICAN',
        format_type: 'AMERICAN_3',
        format_config: null,
      },
      coupleCount: 4,
    })

    expect(rules.maxMatchesPerCouple).toBe(3)
    expect(rules.source).toBe('tournament.format_type')
  })

  it('prioritizes persisted zone rounds_per_couple', () => {
    const rules = ZoneMatchRulesService.resolveRules({
      tournament: {
        type: 'AMERICAN',
        format_config: getTournamentFormatPreset('AMERICAN_MULTI_ZONE_2'),
      },
      zone: {
        rounds_per_couple: 3,
      },
      coupleCount: 4,
    })

    expect(rules.maxMatchesPerCouple).toBe(3)
    expect(rules.source).toBe('zone.rounds_per_couple')
  })
})
