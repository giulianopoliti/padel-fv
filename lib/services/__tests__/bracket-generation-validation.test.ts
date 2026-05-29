import {
  calculateCoupleMatchCounts,
  calculateExpectedZoneMatches,
  findCouplesBelowRequiredMatches,
  resolveEffectiveRoundsPerCoupleForValidation,
} from '@/lib/services/bracket-generation-validation'
import { getTournamentFormatPreset } from '@/config/tournament-format-presets'

describe('bracket-generation-validation', () => {
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
  })
})
