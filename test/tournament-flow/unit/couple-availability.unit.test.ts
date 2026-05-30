import { CoupleAvailabilityService } from '@/lib/services/couple-availability.service'
import { ZoneMatchRulesService } from '@/lib/services/zone-match-rules.service'

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}))

const { createClient } = jest.requireMock('@/utils/supabase/server')

const createQuery = (result: any) => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  or: jest.fn().mockResolvedValue(result),
  then: (resolve: any) => resolve(result),
})

describe('tournament flow unit: couple availability', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('uses ZoneMatchRulesService instead of hardcoded zone sizes', async () => {
    jest.spyOn(ZoneMatchRulesService, 'getRulesForZone').mockResolvedValue({
      maxMatchesPerCouple: 3,
      coupleCount: 4,
      source: 'synced-zone-rules',
    })

    const matchesQuery = createQuery({
      data: [{ id: 'match-1' }, { id: 'match-2' }],
      error: null,
    })

    createClient.mockResolvedValue({
      from: jest.fn().mockReturnValue(matchesQuery),
    })

    const result = await CoupleAvailabilityService.canCouplePlayMore('zone-1', 'couple-1')

    expect(result).toEqual({
      canPlay: true,
      currentMatches: 2,
      maxMatches: 3,
      reason: undefined,
    })
    expect(ZoneMatchRulesService.getRulesForZone).toHaveBeenCalledWith(expect.anything(), 'zone-1')
  })
})
