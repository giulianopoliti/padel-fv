import { getTournamentFormatPreset } from '@/config/tournament-format-presets'
import { AdvancementPlanner } from '@/lib/services/advancement-planner.service'
import { TournamentFormatResolver } from '@/lib/services/tournament-format-resolver'
import { ZoneFixturePlanner } from '@/lib/services/zone-fixture-planner.service'

describe('Tournament format v2', () => {
  it('maps legacy american tournaments to multi-zone 2 matches', () => {
    const resolved = TournamentFormatResolver.getResolvedFormat({ type: 'AMERICAN' })

    expect(resolved.presetId).toBe('AMERICAN_MULTI_ZONE_2')
    expect(resolved.zoneMode).toBe('MULTI_ZONE')
  })

  it('applies the 5-couple single-zone american override', () => {
    const resolved = TournamentFormatResolver.getResolvedFormat(
      { format_config: getTournamentFormatPreset('AMERICAN_SINGLE_ZONE_3_BRACKET') },
      { totalCouples: 5 }
    )

    expect(resolved.effectiveZoneStage).toBe('ROUND_ROBIN')
    expect(resolved.effectiveTargetMatchesPerCouple).toBe(4)
    expect(resolved.effectiveAdvancementConfig.kind).toBe('SINGLE')
    if (resolved.effectiveAdvancementConfig.kind === 'SINGLE') {
      expect(resolved.effectiveAdvancementConfig.advanceCount).toBe(4)
    }
  })

  it('plans american multi-zone 3-match tournaments with 3 and 4-couple zones only', () => {
    const plan = ZoneFixturePlanner.plan(11, getTournamentFormatPreset('AMERICAN_MULTI_ZONE_3'))

    expect(plan.isValid).toBe(true)
    expect(plan.zones.map((zone) => zone.size)).toEqual([4, 4, 3])
    expect(plan.zones[2].matchesPerCouple).toBe(2)
  })

  it('rejects invalid gold/silver splits', () => {
    const config = getTournamentFormatPreset('LONG_SINGLE_ZONE_GOLD_SILVER')
    if (config.advancementConfig.kind === 'GOLD_SILVER') {
      config.advancementConfig.goldCount = 4
      config.advancementConfig.silverCount = 4
      config.advancementConfig.eliminatedCount = 1
    }

    const validation = AdvancementPlanner.validateAdvancementCounts(10, config)

    expect(validation.isValid).toBe(false)
  })

  it('splits gold, silver and eliminated couples from ranking order', () => {
    const config = getTournamentFormatPreset('AMERICAN_SINGLE_ZONE_ROUND_ROBIN_GOLD_SILVER')
    if (config.advancementConfig.kind === 'GOLD_SILVER') {
      config.advancementConfig.goldCount = 4
      config.advancementConfig.silverCount = 4
      config.advancementConfig.eliminatedCount = 2
    }

    const ranking = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
    const result = AdvancementPlanner.splitRankedEntries(ranking, config, { totalCouples: ranking.length })

    expect(result.gold).toEqual(['A', 'B', 'C', 'D'])
    expect(result.silver).toEqual(['E', 'F', 'G', 'H'])
    expect(result.eliminated).toEqual(['I', 'J'])
  })
})

