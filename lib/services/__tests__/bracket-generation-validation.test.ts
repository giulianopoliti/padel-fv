import {
  calculateCoupleMatchCounts,
  calculateExpectedZoneMatches,
  findBlockingIncompleteCouplesWithActiveOpponentCapacity,
  findCouplesBelowRequiredMatches,
  resolveEffectiveRoundsPerCoupleForValidation,
  validatePlaceholderBracketGeneration,
} from '@/lib/services/bracket-generation-validation'
import { getTournamentFormatPreset } from '@/config/tournament-format-presets'
import { createClientServiceRole } from '@/utils/supabase/server'

jest.mock('@/utils/supabase/server', () => ({
  createClientServiceRole: jest.fn(),
}))

const tournamentId = 'tournament-long'
const zoneId = 'zone-general'

function createSupabaseValidationMock(matches: Array<{ id: string; couple1_id: string; couple2_id: string }>) {
  const tournament = {
    id: tournamentId,
    status: 'ZONE_PHASE',
    bracket_status: 'NOT_STARTED',
    bracket_generated_at: null,
    type: 'LONG',
    format_type: 'AMERICAN_2',
    format_config: {
      ...getTournamentFormatPreset('LONG_SINGLE_ZONE_BRACKET'),
      zoneStage: 'ROUND_ROBIN',
      targetMatchesPerCouple: null,
    },
  }
  const zones = [{
    id: zoneId,
    name: 'Zona General',
    tournament_id: tournamentId,
    capacity: 10,
    max_couples: 32,
    rounds_per_couple: 0,
  }]
  const zonePositions = Array.from({ length: 10 }, (_, index) => ({
    couple_id: `couple-${index + 1}`,
  }))

  class QueryBuilder {
    private filters: Record<string, any> = {}
    private countOnly = false
    private singleRow = false
    private updatePayload: Record<string, any> | null = null

    constructor(private table: string) {}

    select(_columns?: string, options?: { count?: string; head?: boolean }) {
      this.countOnly = Boolean(options?.head)
      return this
    }

    eq(column: string, value: any) {
      this.filters[column] = value
      return this
    }

    in(column: string, value: any[]) {
      this.filters[column] = value
      return this
    }

    update(payload: Record<string, any>) {
      this.updatePayload = payload
      return this
    }

    single() {
      this.singleRow = true
      return this
    }

    then(resolve: (value: any) => void) {
      resolve(this.execute())
    }

    private execute() {
      if (this.updatePayload && this.table === 'zones') {
        const zone = zones.find((currentZone) => currentZone.id === this.filters.id)
        if (zone) {
          Object.assign(zone, this.updatePayload)
        }
        return { error: null }
      }

      if (this.countOnly) {
        return { count: 0, error: null }
      }

      if (this.table === 'tournaments') {
        return this.singleRow ? { data: tournament, error: null } : { data: [tournament], error: null }
      }

      if (this.table === 'zones') {
        const filteredZones = zones.filter((zone) => (
          !this.filters.tournament_id || zone.tournament_id === this.filters.tournament_id
        ))
        return this.singleRow ? { data: filteredZones[0] || null, error: null } : { data: filteredZones, error: null }
      }

      if (this.table === 'zone_positions') {
        return { data: zonePositions, error: null }
      }

      if (this.table === 'zone_couples') {
        return { data: [], error: null }
      }

      if (this.table === 'matches') {
        const filteredMatches = matches.filter((match) => (
          !this.filters.zone_id || this.filters.zone_id === zoneId
        ))
        return { data: filteredMatches, error: null }
      }

      return { data: [], error: null }
    }
  }

  return {
    from: (table: string) => new QueryBuilder(table),
  }
}

describe('bracket-generation-validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('calculateExpectedZoneMatches', () => {
    it('calculates expected created matches for MZ2 and MZ3 zone rules', () => {
      // MZ2 zone of 4 => 2 partidos por pareja => 4 partidos totales
      expect(calculateExpectedZoneMatches(4, 2)).toBe(4)

      // MZ3 zone of 4 => 3 partidos por pareja => 6 partidos totales
      expect(calculateExpectedZoneMatches(4, 3)).toBe(6)

      // Zone of 3 (MZ2/MZ3) => 2 partidos por pareja => 3 partidos totales
      expect(calculateExpectedZoneMatches(3, 2)).toBe(3)
    })

    it('returns 0 for invalid values', () => {
      expect(calculateExpectedZoneMatches(0, 2)).toBe(0)
      expect(calculateExpectedZoneMatches(4, 0)).toBe(0)
      expect(calculateExpectedZoneMatches(-1, 2)).toBe(0)
    })
  })

  describe('resolveEffectiveRoundsPerCoupleForValidation', () => {
    it('uses canonical rounds for AMERICAN_3 zone of 3 when persisted value is stale', () => {
      const rounds = resolveEffectiveRoundsPerCoupleForValidation(
        {
          type: 'AMERICAN',
          format_type: 'AMERICAN_3',
          format_config: null,
        },
        {
          rounds_per_couple: 3,
        },
        3
      )

      expect(rounds).toBe(2)
    })

    it('allows v2 AMERICAN_MULTI_ZONE_3 zones of 3 to play 2 matches per couple', () => {
      const rounds = resolveEffectiveRoundsPerCoupleForValidation(
        {
          type: 'AMERICAN',
          format_type: 'AMERICAN_3',
          format_config: getTournamentFormatPreset('AMERICAN_MULTI_ZONE_3'),
        },
        {
          rounds_per_couple: 2,
        },
        3
      )

      expect(rounds).toBe(2)
    })

    it('uses explicit LONG gold/silver target matches even when stale config says round robin', () => {
      const rounds = resolveEffectiveRoundsPerCoupleForValidation(
        {
          type: 'LONG',
          format_type: 'AMERICAN_2',
          format_config: {
            ...getTournamentFormatPreset('LONG_SINGLE_ZONE_GOLD_SILVER'),
            zoneStage: 'ROUND_ROBIN',
            targetMatchesPerCouple: 3,
          },
        },
        {
          rounds_per_couple: 9,
        },
        10
      )

      expect(rounds).toBe(3)
    })

    it('keeps persisted rounds when aligned with canonical rules', () => {
      const rounds = resolveEffectiveRoundsPerCoupleForValidation(
        {
          type: 'AMERICAN',
          format_type: 'AMERICAN_3',
          format_config: null,
        },
        {
          rounds_per_couple: 3,
        },
        4
      )

      expect(rounds).toBe(3)
    })
  })

  describe('couple-level match requirements', () => {
    it('counts created matches per couple in a zone', () => {
      const counts = calculateCoupleMatchCounts(
        ['couple-a', 'couple-b', 'couple-c', 'couple-d'],
        [
          { couple1_id: 'couple-a', couple2_id: 'couple-b' },
          { couple1_id: 'couple-a', couple2_id: 'couple-c' },
          { couple1_id: 'couple-a', couple2_id: 'couple-d' },
          { couple1_id: 'couple-b', couple2_id: 'couple-c' },
        ]
      )

      expect(counts).toEqual({
        'couple-a': 3,
        'couple-b': 2,
        'couple-c': 2,
        'couple-d': 1,
      })
    })

    it('detects couples below the required matches for AMERICAN_MULTI_ZONE_3', () => {
      const incompleteCouples = findCouplesBelowRequiredMatches(
        {
          'couple-a': 3,
          'couple-b': 3,
          'couple-c': 2,
          'couple-d': 1,
        },
        3
      )

      expect(incompleteCouples).toEqual([
        { coupleId: 'couple-c', matchCount: 2, missingMatches: 1 },
        { coupleId: 'couple-d', matchCount: 1, missingMatches: 2 },
      ])
    })

    it('does not block an incomplete active couple when no active opponent has capacity after a DQ', () => {
      const counts = calculateCoupleMatchCounts(
        ['couple-a', 'couple-b', 'couple-c'],
        [
          { couple1_id: 'couple-a', couple2_id: 'couple-b' },
          { couple1_id: 'couple-a', couple2_id: 'couple-c' },
          { couple1_id: 'couple-b', couple2_id: 'dq-couple' },
        ]
      )

      expect(findBlockingIncompleteCouplesWithActiveOpponentCapacity(
        ['couple-a', 'couple-b', 'couple-c'],
        counts,
        [
          { couple1_id: 'couple-a', couple2_id: 'couple-b' },
          { couple1_id: 'couple-a', couple2_id: 'couple-c' },
          { couple1_id: 'couple-b', couple2_id: 'dq-couple' },
        ],
        2
      )).toEqual([])
    })

    it('blocks incomplete active couples that can still play each other', () => {
      const counts = calculateCoupleMatchCounts(
        ['couple-a', 'couple-b', 'couple-c'],
        [
          { couple1_id: 'couple-a', couple2_id: 'couple-b' },
          { couple1_id: 'couple-a', couple2_id: 'couple-c' },
        ]
      )

      expect(findBlockingIncompleteCouplesWithActiveOpponentCapacity(
        ['couple-a', 'couple-b', 'couple-c'],
        counts,
        [
          { couple1_id: 'couple-a', couple2_id: 'couple-b' },
          { couple1_id: 'couple-a', couple2_id: 'couple-c' },
        ],
        2
      )).toEqual([
        { coupleId: 'couple-b', matchCount: 1, missingMatches: 1 },
        { coupleId: 'couple-c', matchCount: 1, missingMatches: 1 },
      ])
    })
  })

  describe('validatePlaceholderBracketGeneration', () => {
    it('fails when a LONG couple has fewer matches than configured', async () => {
      ;(createClientServiceRole as jest.Mock).mockResolvedValue(createSupabaseValidationMock([
        { id: 'match-1', couple1_id: 'couple-1', couple2_id: 'couple-2' },
        { id: 'match-2', couple1_id: 'couple-1', couple2_id: 'couple-3' },
        { id: 'match-3', couple1_id: 'couple-1', couple2_id: 'couple-4' },
      ]))

      const validation = await validatePlaceholderBracketGeneration(tournamentId)

      expect(validation.success).toBe(false)
      expect(validation.code).toBe('ZONE_MATCHES_INCOMPLETE')
      expect(validation.requiredMatchesPerCoupleValues).toEqual([3])
    })

    it('passes when every LONG couple reaches the configured matches', async () => {
      const matches = [
        ['couple-1', 'couple-2'],
        ['couple-1', 'couple-3'],
        ['couple-1', 'couple-4'],
        ['couple-2', 'couple-3'],
        ['couple-2', 'couple-5'],
        ['couple-3', 'couple-6'],
        ['couple-4', 'couple-5'],
        ['couple-4', 'couple-7'],
        ['couple-5', 'couple-8'],
        ['couple-6', 'couple-7'],
        ['couple-6', 'couple-9'],
        ['couple-7', 'couple-10'],
        ['couple-8', 'couple-9'],
        ['couple-8', 'couple-10'],
        ['couple-9', 'couple-10'],
      ].map(([couple1_id, couple2_id], index) => ({
        id: `match-${index + 1}`,
        couple1_id,
        couple2_id,
      }))
      ;(createClientServiceRole as jest.Mock).mockResolvedValue(createSupabaseValidationMock(matches))

      const validation = await validatePlaceholderBracketGeneration(tournamentId)

      expect(validation.success).toBe(true)
      expect(validation.requiredMatchesPerCoupleValues).toEqual([3])
    })
  })
})
