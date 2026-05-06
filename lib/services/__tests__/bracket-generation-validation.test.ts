import {
  calculateExpectedZoneMatches,
  resolveEffectiveRoundsPerCoupleForValidation,
} from '@/lib/services/bracket-generation-validation'

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
})
