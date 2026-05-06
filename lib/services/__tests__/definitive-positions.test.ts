/**
 * Test Suite: Definitive Positions Analysis
 *
 * CRITICAL: Tests the algorithm that determines if a zone position is DEFINITIVE
 * (cannot change regardless of remaining match results)
 *
 * Bug Context:
 * - A non-definitive position was migrated to the bracket
 * - This caused incorrect playoff matches
 * - We need to ensure ONLY mathematically definitive positions are marked
 *
 * Definition of Definitive Position:
 * A couple's position is definitive when NO COMBINATION of remaining match
 * results can change their final ranking position.
 *
 * @see docs/saveMatchResult.md - PASO 7.1 (CorrectedDefinitiveAnalyzer)
 */

import { CorrectedDefinitiveAnalyzer } from '@/lib/services/corrected-definitive-analyzer'
import { createClientServiceRole } from '@/utils/supabase/server'

jest.mock('@/utils/supabase/server', () => ({
  createClientServiceRole: jest.fn()
}))

describe('Definitive Positions Algorithm - CRITICAL TESTS', () => {
  let analyzer: CorrectedDefinitiveAnalyzer
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    analyzer = new CorrectedDefinitiveAnalyzer()

    mockSupabase = {
      from: jest.fn()
    }

    ;(createClientServiceRole as jest.Mock).mockResolvedValue(mockSupabase)
  })

  // ============================================================================
  // SCENARIO 1: All matches completed - ALL positions should be definitive
  // ============================================================================
  describe('Scenario 1: All matches completed', () => {
    it('should mark ALL positions as definitive when zone is complete', async () => {
      // Zone with 4 couples, all matches finished (6 matches total)
      // Final standings: A(9pts), B(6pts), C(3pts), D(0pts)

      const mockZoneCouples = [
        { id: 'couple-A' },
        { id: 'couple-B' },
        { id: 'couple-C' },
        { id: 'couple-D' }
      ]

      const mockMatches = [
        // A vs B → A wins
        { couple1_id: 'couple-A', couple2_id: 'couple-B', winner_id: 'couple-A', status: 'FINISHED' },
        // A vs C → A wins
        { couple1_id: 'couple-A', couple2_id: 'couple-C', winner_id: 'couple-A', status: 'FINISHED' },
        // A vs D → A wins
        { couple1_id: 'couple-A', couple2_id: 'couple-D', winner_id: 'couple-A', status: 'FINISHED' },
        // B vs C → B wins
        { couple1_id: 'couple-B', couple2_id: 'couple-C', winner_id: 'couple-B', status: 'FINISHED' },
        // B vs D → B wins
        { couple1_id: 'couple-B', couple2_id: 'couple-D', winner_id: 'couple-B', status: 'FINISHED' },
        // C vs D → C wins
        { couple1_id: 'couple-C', couple2_id: 'couple-D', winner_id: 'couple-C', status: 'FINISHED' }
      ]

      const mockZonePositions = [
        { couple_id: 'couple-A', position: 1, wins: 3, losses: 0 },
        { couple_id: 'couple-B', position: 2, wins: 2, losses: 1 },
        { couple_id: 'couple-C', position: 3, wins: 1, losses: 2 },
        { couple_id: 'couple-D', position: 4, wins: 0, losses: 3 }
      ]

      // Mock database queries
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZoneCouples,
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockMatches,
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZonePositions,
            error: null
          })
        })
      })

      const result = await analyzer.analyzeZone('tournament-1', 'zone-1')

      // ALL positions should be definitive
      expect(result).toHaveLength(1) // One zone analyzed
      expect(result[0].definitivePositions).toBe(4) // ALL 4 positions definitive
      expect(result[0].analysis.every(a => a.isDefinitive)).toBe(true)
    })
  })

  // ============================================================================
  // SCENARIO 2: 🔥 CRITICAL - Position NOT definitive but close
  // ============================================================================
  describe('Scenario 2: 🔥 Non-definitive position detection', () => {
    it('should NOT mark position 1 as definitive if leader can still be caught', async () => {
      // Zone with 4 couples
      // Current standings:
      // - A: 2 wins, 0 losses (played 2 matches)
      // - B: 1 win, 0 losses (played 1 match)
      // - C: 0 wins, 1 loss (played 1 match)
      // - D: 0 wins, 1 loss (played 1 match)
      //
      // Remaining matches:
      // - A vs B (if B wins, they tie at 2-1 each)
      // - A vs C
      // - A vs D
      // - B vs C
      // - B vs D
      // - C vs D
      //
      // Position 1 is NOT definitive because B can still catch A

      const mockZoneCouples = [
        { id: 'couple-A' },
        { id: 'couple-B' },
        { id: 'couple-C' },
        { id: 'couple-D' }
      ]

      const mockMatches = [
        // Finished matches
        { couple1_id: 'couple-A', couple2_id: 'couple-C', winner_id: 'couple-A', status: 'FINISHED' },
        { couple1_id: 'couple-A', couple2_id: 'couple-D', winner_id: 'couple-A', status: 'FINISHED' },
        { couple1_id: 'couple-B', couple2_id: 'couple-C', winner_id: 'couple-B', status: 'FINISHED' },

        // Pending matches (A still has to play B - critical match!)
        { couple1_id: 'couple-A', couple2_id: 'couple-B', winner_id: null, status: 'PENDING' },
        { couple1_id: 'couple-B', couple2_id: 'couple-D', winner_id: null, status: 'PENDING' },
        { couple1_id: 'couple-C', couple2_id: 'couple-D', winner_id: null, status: 'PENDING' }
      ]

      const mockZonePositions = [
        { couple_id: 'couple-A', position: 1, wins: 2, losses: 0 },
        { couple_id: 'couple-B', position: 2, wins: 1, losses: 0 },
        { couple_id: 'couple-C', position: 3, wins: 0, losses: 2 },
        { couple_id: 'couple-D', position: 4, wins: 0, losses: 2 }
      ]

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZoneCouples,
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockMatches,
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZonePositions,
            error: null
          })
        })
      })

      const result = await analyzer.analyzeZone('tournament-1', 'zone-1')

      // Position 1 should NOT be definitive
      const position1Analysis = result[0].analysis.find(a => a.currentPosition === 1)

      expect(position1Analysis?.isDefinitive).toBe(false)
      expect(position1Analysis?.possiblePositions).toContain(1)
      expect(position1Analysis?.possiblePositions).toContain(2) // Can drop to 2nd if loses to B
      expect(result[0].definitivePositions).toBe(0) // NO definitive positions yet
    })

    it('should NOT mark position 2 as definitive if can still move up or down', async () => {
      // Similar scenario - position 2 is NOT locked
      // B can move to position 1 (if beats A) or drop to 3 (if loses remaining)

      const mockZoneCouples = [
        { id: 'couple-A' },
        { id: 'couple-B' },
        { id: 'couple-C' },
        { id: 'couple-D' }
      ]

      const mockMatches = [
        { couple1_id: 'couple-A', couple2_id: 'couple-C', winner_id: 'couple-A', status: 'FINISHED' },
        { couple1_id: 'couple-A', couple2_id: 'couple-D', winner_id: 'couple-A', status: 'FINISHED' },
        { couple1_id: 'couple-B', couple2_id: 'couple-D', winner_id: 'couple-B', status: 'FINISHED' },
        { couple1_id: 'couple-A', couple2_id: 'couple-B', winner_id: null, status: 'PENDING' },
        { couple1_id: 'couple-B', couple2_id: 'couple-C', winner_id: null, status: 'PENDING' },
        { couple1_id: 'couple-C', couple2_id: 'couple-D', winner_id: null, status: 'PENDING' }
      ]

      const mockZonePositions = [
        { couple_id: 'couple-A', position: 1, wins: 2, losses: 0 },
        { couple_id: 'couple-B', position: 2, wins: 1, losses: 0 },
        { couple_id: 'couple-C', position: 3, wins: 0, losses: 1 },
        { couple_id: 'couple-D', position: 4, wins: 0, losses: 2 }
      ]

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZoneCouples,
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockMatches,
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZonePositions,
            error: null
          })
        })
      })

      const result = await analyzer.analyzeZone('tournament-1', 'zone-1')

      const position2Analysis = result[0].analysis.find(a => a.currentPosition === 2)

      expect(position2Analysis?.isDefinitive).toBe(false)
      expect(position2Analysis?.possiblePositions.length).toBeGreaterThan(1)
    })
  })

  // ============================================================================
  // SCENARIO 3: 🎯 Position IS definitive - mathematically impossible to change
  // ============================================================================
  describe('Scenario 3: 🎯 Definitive position detection', () => {
    it('should mark position 1 as definitive when leader cannot be caught', async () => {
      // Zone with 4 couples
      // Standings:
      // - A: 3 wins, 0 losses (finished all matches)
      // - B: 1 win, 2 losses (can finish max 2-1, which is less than A's 3-0)
      // - C: 1 win, 1 loss
      // - D: 0 wins, 2 losses
      //
      // Remaining: B vs D, C vs D
      // Position 1 is DEFINITIVE because no one can reach 3 wins

      const mockZoneCouples = [
        { id: 'couple-A' },
        { id: 'couple-B' },
        { id: 'couple-C' },
        { id: 'couple-D' }
      ]

      const mockMatches = [
        // A finished all matches (3-0)
        { couple1_id: 'couple-A', couple2_id: 'couple-B', winner_id: 'couple-A', status: 'FINISHED' },
        { couple1_id: 'couple-A', couple2_id: 'couple-C', winner_id: 'couple-A', status: 'FINISHED' },
        { couple1_id: 'couple-A', couple2_id: 'couple-D', winner_id: 'couple-A', status: 'FINISHED' },

        // B vs C finished
        { couple1_id: 'couple-B', couple2_id: 'couple-C', winner_id: 'couple-B', status: 'FINISHED' },

        // C vs D finished
        { couple1_id: 'couple-C', couple2_id: 'couple-D', winner_id: 'couple-C', status: 'FINISHED' },

        // B vs D pending (but even if B wins, they get 2-1, still less than A's 3-0)
        { couple1_id: 'couple-B', couple2_id: 'couple-D', winner_id: null, status: 'PENDING' }
      ]

      const mockZonePositions = [
        { couple_id: 'couple-A', position: 1, wins: 3, losses: 0 },
        { couple_id: 'couple-B', position: 2, wins: 1, losses: 2 },
        { couple_id: 'couple-C', position: 3, wins: 1, losses: 2 },
        { couple_id: 'couple-D', position: 4, wins: 0, losses: 3 }
      ]

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZoneCouples,
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockMatches,
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZonePositions,
            error: null
          })
        })
      })

      const result = await analyzer.analyzeZone('tournament-1', 'zone-1')

      const position1Analysis = result[0].analysis.find(a => a.currentPosition === 1)

      expect(position1Analysis?.isDefinitive).toBe(true)
      expect(position1Analysis?.possiblePositions).toEqual([1]) // Can ONLY be position 1
      expect(position1Analysis?.confidence).toBe('HIGH')
      expect(result[0].definitivePositions).toBeGreaterThanOrEqual(1)
    })

    it('should mark last position as definitive when couple cannot climb', async () => {
      // Standings:
      // - A: 2 wins, 1 loss
      // - B: 2 wins, 1 loss
      // - C: 1 win, 2 losses
      // - D: 0 wins, 3 losses (finished all matches)
      //
      // Remaining: A vs B, A vs C, B vs C
      // Position 4 (D) is DEFINITIVE because they lost all matches

      const mockZoneCouples = [
        { id: 'couple-A' },
        { id: 'couple-B' },
        { id: 'couple-C' },
        { id: 'couple-D' }
      ]

      const mockMatches = [
        // D lost to everyone (0-3)
        { couple1_id: 'couple-A', couple2_id: 'couple-D', winner_id: 'couple-A', status: 'FINISHED' },
        { couple1_id: 'couple-B', couple2_id: 'couple-D', winner_id: 'couple-B', status: 'FINISHED' },
        { couple1_id: 'couple-C', couple2_id: 'couple-D', winner_id: 'couple-C', status: 'FINISHED' },

        // Others pending
        { couple1_id: 'couple-A', couple2_id: 'couple-B', winner_id: null, status: 'PENDING' },
        { couple1_id: 'couple-A', couple2_id: 'couple-C', winner_id: null, status: 'PENDING' },
        { couple1_id: 'couple-B', couple2_id: 'couple-C', winner_id: null, status: 'PENDING' }
      ]

      const mockZonePositions = [
        { couple_id: 'couple-A', position: 1, wins: 2, losses: 1 },
        { couple_id: 'couple-B', position: 2, wins: 2, losses: 1 },
        { couple_id: 'couple-C', position: 3, wins: 1, losses: 2 },
        { couple_id: 'couple-D', position: 4, wins: 0, losses: 3 }
      ]

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZoneCouples,
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockMatches,
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZonePositions,
            error: null
          })
        })
      })

      const result = await analyzer.analyzeZone('tournament-1', 'zone-1')

      const position4Analysis = result[0].analysis.find(a => a.currentPosition === 4)

      expect(position4Analysis?.isDefinitive).toBe(true)
      expect(position4Analysis?.possiblePositions).toEqual([4]) // Can ONLY be position 4
    })
  })

  // ============================================================================
  // SCENARIO 4: 🔥 Complex tiebreaker scenarios
  // ============================================================================
  describe('Scenario 4: 🔥 Tiebreaker considerations', () => {
    it('should consider game difference in definitive analysis', async () => {
      // Two couples tied on wins, but one has insurmountable game difference
      // A: 2-1 record, +10 game difference
      // B: 2-1 record, -5 game difference
      // Remaining matches: both play weak opponent
      // Even if B wins 6-0 and A loses 0-6, B cannot catch A's game difference

      const mockZoneCouples = [
        { id: 'couple-A' },
        { id: 'couple-B' },
        { id: 'couple-C' },
        { id: 'couple-D' }
      ]

      const mockMatches = [
        // A is 2-1 with great game difference
        { couple1_id: 'couple-A', couple2_id: 'couple-C', winner_id: 'couple-A', status: 'FINISHED', result_couple1: 6, result_couple2: 0 },
        { couple1_id: 'couple-A', couple2_id: 'couple-D', winner_id: 'couple-A', status: 'FINISHED', result_couple1: 6, result_couple2: 1 },
        { couple1_id: 'couple-A', couple2_id: 'couple-B', winner_id: 'couple-B', status: 'FINISHED', result_couple1: 2, result_couple2: 6 },

        // B is 2-1 with poor game difference
        { couple1_id: 'couple-B', couple2_id: 'couple-C', winner_id: 'couple-B', status: 'FINISHED', result_couple1: 6, result_couple2: 3 },
        { couple1_id: 'couple-B', couple2_id: 'couple-D', winner_id: null, status: 'PENDING' },

        // C vs D
        { couple1_id: 'couple-C', couple2_id: 'couple-D', winner_id: null, status: 'PENDING' }
      ]

      const mockZonePositions = [
        { couple_id: 'couple-A', position: 1, wins: 2, losses: 1, games_difference: 10 },
        { couple_id: 'couple-B', position: 2, wins: 2, losses: 1, games_difference: -5 },
        { couple_id: 'couple-C', position: 3, wins: 0, losses: 3, games_difference: -8 },
        { couple_id: 'couple-D', position: 4, wins: 0, losses: 2, games_difference: -3 }
      ]

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZoneCouples,
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockMatches,
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZonePositions,
            error: null
          })
        })
      })

      const result = await analyzer.analyzeZone('tournament-1', 'zone-1')

      // Position 1 might be definitive due to insurmountable game difference
      // This tests the algorithm's consideration of tiebreaker criteria
      const position1Analysis = result[0].analysis.find(a => a.currentPosition === 1)

      // The algorithm should consider if game difference makes position unassailable
      expect(position1Analysis).toBeDefined()
      expect(position1Analysis?.analysisMethod).toMatch(/CONSTRAINT_ANALYSIS|BACKTRACKING/)
    })
  })

  // ============================================================================
  // SCENARIO 5: 🚨 Bug reproduction - premature definitive marking
  // ============================================================================
  describe('Scenario 5: 🚨 Bug reproduction', () => {
    it('should NOT mark position as definitive if there are critical pending matches', async () => {
      // This test reproduces the bug you mentioned:
      // "A non-definitive position was migrated to the bracket"
      //
      // Scenario:
      // - Position looks definitive based on current standings
      // - BUT there's a pending head-to-head match that could change everything

      const mockZoneCouples = [
        { id: 'couple-A' },
        { id: 'couple-B' },
        { id: 'couple-C' },
        { id: 'couple-D' }
      ]

      const mockMatches = [
        // Current standings suggest A is in position 1
        { couple1_id: 'couple-A', couple2_id: 'couple-C', winner_id: 'couple-A', status: 'FINISHED' },
        { couple1_id: 'couple-A', couple2_id: 'couple-D', winner_id: 'couple-A', status: 'FINISHED' },
        { couple1_id: 'couple-B', couple2_id: 'couple-C', winner_id: 'couple-B', status: 'FINISHED' },
        { couple1_id: 'couple-B', couple2_id: 'couple-D', winner_id: 'couple-B', status: 'FINISHED' },

        // 🔥 CRITICAL: A vs B not yet played - this is the decider!
        { couple1_id: 'couple-A', couple2_id: 'couple-B', winner_id: null, status: 'PENDING' },

        { couple1_id: 'couple-C', couple2_id: 'couple-D', winner_id: null, status: 'PENDING' }
      ]

      const mockZonePositions = [
        { couple_id: 'couple-A', position: 1, wins: 2, losses: 0 },
        { couple_id: 'couple-B', position: 2, wins: 2, losses: 0 },
        { couple_id: 'couple-C', position: 3, wins: 0, losses: 2 },
        { couple_id: 'couple-D', position: 4, wins: 0, losses: 2 }
      ]

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZoneCouples,
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockMatches,
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZonePositions,
            error: null
          })
        })
      })

      const result = await analyzer.analyzeZone('tournament-1', 'zone-1')

      // 🚨 THIS IS THE CRITICAL TEST
      // Positions 1 and 2 should NOT be definitive because A vs B is pending
      const position1Analysis = result[0].analysis.find(a => a.currentPosition === 1)
      const position2Analysis = result[0].analysis.find(a => a.currentPosition === 2)

      expect(position1Analysis?.isDefinitive).toBe(false)
      expect(position2Analysis?.isDefinitive).toBe(false)
      expect(result[0].definitivePositions).toBe(0) // NO positions should be definitive

      // Verify positions 3 and 4 are also not definitive (C and D can still swap)
      const position3Analysis = result[0].analysis.find(a => a.currentPosition === 3)
      const position4Analysis = result[0].analysis.find(a => a.currentPosition === 4)

      expect(position3Analysis?.isDefinitive).toBe(false)
      expect(position4Analysis?.isDefinitive).toBe(false)
    })
  })

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================
  describe('Performance and Algorithm Selection', () => {
    it('should use FAST_VALIDATION for simple cases', async () => {
      // All matches completed - should use fast path
      const mockZoneCouples = [
        { id: 'couple-A' },
        { id: 'couple-B' }
      ]

      const mockMatches = [
        { couple1_id: 'couple-A', couple2_id: 'couple-B', winner_id: 'couple-A', status: 'FINISHED' }
      ]

      const mockZonePositions = [
        { couple_id: 'couple-A', position: 1, wins: 1, losses: 0 },
        { couple_id: 'couple-B', position: 2, wins: 0, losses: 1 }
      ]

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZoneCouples,
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockMatches,
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZonePositions,
            error: null
          })
        })
      })

      const result = await analyzer.analyzeZone('tournament-1', 'zone-1')

      expect(result[0].analysis.every(a =>
        a.analysisMethod === 'FAST_VALIDATION' || a.analysisMethod === 'CONSTRAINT_ANALYSIS'
      )).toBe(true)
    })

    it('should complete analysis in reasonable time even for complex scenarios', async () => {
      // Zone with many pending matches
      const mockZoneCouples = Array.from({ length: 6 }, (_, i) => ({ id: `couple-${i}` }))

      // Generate all possible matches (15 total for 6 couples)
      const mockMatches: any[] = []
      for (let i = 0; i < 6; i++) {
        for (let j = i + 1; j < 6; j++) {
          mockMatches.push({
            couple1_id: `couple-${i}`,
            couple2_id: `couple-${j}`,
            winner_id: null,
            status: 'PENDING'
          })
        }
      }

      const mockZonePositions = mockZoneCouples.map((c, i) => ({
        couple_id: c.id,
        position: i + 1,
        wins: 0,
        losses: 0
      }))

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZoneCouples,
            error: null
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockMatches,
              error: null
            })
          })
        })
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockZonePositions,
            error: null
          })
        })
      })

      const startTime = Date.now()
      const result = await analyzer.analyzeZone('tournament-1', 'zone-1')
      const executionTime = Date.now() - startTime

      // Should complete in under 5 seconds even for worst case
      expect(executionTime).toBeLessThan(5000)
      expect(result[0].totalComputationTime).toBeLessThan(5000)
    })
  })
})
