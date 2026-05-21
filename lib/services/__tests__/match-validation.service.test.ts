import { createClient } from '@/utils/supabase/server'
import { MatchValidationService } from '@/lib/services/match-validation.service'
import { ZoneMatchRulesService } from '@/lib/services/zone-match-rules.service'

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}))

function mockMatchesQuery(matchCount: number) {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockResolvedValue({
      data: Array.from({ length: matchCount }, (_, index) => ({ id: `match-${index}` })),
      error: null,
    }),
  }

  ;(createClient as jest.Mock).mockResolvedValue({
    from: jest.fn().mockReturnValue(query),
  })
}

describe('MatchValidationService', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it('allows the third zone match in a 3-match format', async () => {
    jest.spyOn(ZoneMatchRulesService, 'getRulesForZone').mockResolvedValue({
      maxMatchesPerCouple: 3,
      coupleCount: 4,
      source: 'zone.rounds_per_couple',
    })
    mockMatchesQuery(2)

    const result = await MatchValidationService.validateCoupleMatchLimit('zone-1', 'couple-1')

    expect(result.isValid).toBe(true)
    expect(result.warnings).toEqual(['Esta pareja jugará su último partido en esta zona (3/3)'])
  })

  it('blocks a fourth zone match in a 3-match format', async () => {
    jest.spyOn(ZoneMatchRulesService, 'getRulesForZone').mockResolvedValue({
      maxMatchesPerCouple: 3,
      coupleCount: 4,
      source: 'zone.rounds_per_couple',
    })
    mockMatchesQuery(3)

    const result = await MatchValidationService.validateCoupleMatchLimit('zone-1', 'couple-1')

    expect(result.isValid).toBe(false)
    expect(result.errors[0]?.message).toContain('3/3')
  })

  it('blocks a third zone match in a 2-match format', async () => {
    jest.spyOn(ZoneMatchRulesService, 'getRulesForZone').mockResolvedValue({
      maxMatchesPerCouple: 2,
      coupleCount: 4,
      source: 'tournament.format_config',
    })
    mockMatchesQuery(2)

    const result = await MatchValidationService.validateCoupleMatchLimit('zone-1', 'couple-1')

    expect(result.isValid).toBe(false)
    expect(result.errors[0]?.message).toContain('2/2')
  })
})
