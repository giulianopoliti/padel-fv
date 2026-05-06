/**
 * SPECIFIC TEST: Silvana/Jose Bug - Intermediate Position Tiebreaker
 *
 * This test reproduces the EXACT bug found in production:
 * - Tournament: b7aaf7a4-058e-427d-ac1b-28768311346a
 * - Zone: Zona A (8f0c838e-90df-4cec-b8a5-860d11b90a17)
 * - Bug: Silvana/Jose marked as definitive when they can drop to 3rd
 */

import { CorrectedDefinitiveAnalyzer } from '@/lib/services/corrected-definitive-analyzer'
import { createClient, createClientServiceRole } from '@/utils/supabase/server'

// Mock Supabase at module level
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
  createClientServiceRole: jest.fn()
}))

describe('PRODUCTION BUG: Silvana Position 2 Not Definitive', () => {
  let analyzer: CorrectedDefinitiveAnalyzer
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    analyzer = new CorrectedDefinitiveAnalyzer()

    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              then: jest.fn()
            }),
            in: jest.fn().mockReturnValue({
              then: jest.fn()
            }),
            single: jest.fn().mockReturnValue({
              then: jest.fn()
            })
          }),
          order: jest.fn().mockReturnValue({
            then: jest.fn()
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: null
            })
          })
        })
      })
    }
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)
    ;(createClientServiceRole as jest.Mock).mockResolvedValue(mockSupabase)
  })

  it('should NOT mark Silvana (1W-1L, -3 diff) as definitive with pending match', async () => {
    /**
     * EXACT PRODUCTION STATE:
     *
     * Position 1: Jorge Pedro/Jorge Raul - 2W-0L, +9 diff → DEFINITIVE ✅
     * Position 2: Silvana/Jose - 1W-1L, -3 diff → SHOULD NOT BE DEFINITIVE ❌
     * Position 3: Mica/Giuli - 0W-1L, -1 diff
     * Position 4: Martin/Martin - 0W-1L, -5 diff
     *
     * PENDING: Mica vs Martin
     *
     * If Martin wins 6-1:
     * - Martin: 1W-1L, 0 diff (better than Silvana's -3)
     * - Martin SURPASSES Silvana → Silvana drops to 3rd
     */

    const zoneId = 'zona-silvana-bug'

    // Exact state from production
    const mockZonePositions = [
      {
        couple_id: 'couple-jorge',
        position: 1,
        wins: 2,
        losses: 0,
        games_for: 12,
        games_against: 3,
        games_difference: 9,
        zone_id: zoneId
      },
      {
        couple_id: 'couple-silvana',
        position: 2,
        wins: 1,
        losses: 1,
        games_for: 9,
        games_against: 12,
        games_difference: -3,
        zone_id: zoneId
      },
      {
        couple_id: 'couple-mica',
        position: 3,
        wins: 0,
        losses: 1,
        games_for: 6,
        games_against: 7,
        games_difference: -1,
        zone_id: zoneId
      },
      {
        couple_id: 'couple-martin',
        position: 4,
        wins: 0,
        losses: 1,
        games_for: 1,
        games_against: 6,
        games_difference: -5,
        zone_id: zoneId
      }
    ]

    const mockPendingMatches = [
      {
        id: 'match-mica-martin',
        couple1_id: 'couple-mica',
        couple2_id: 'couple-martin',
        status: 'IN_PROGRESS'
      }
    ]

    // Setup mocks
    setupMockSupabase(mockSupabase, zoneId, mockZonePositions, mockPendingMatches)

    // ACT
    const result = await analyzer.analyzeZonePositions(zoneId)

    // ASSERTIONS
    console.log('\n=== SILVANA BUG TEST RESULTS ===')
    result.analysis.forEach(a => {
      console.log(`Couple ${a.coupleId}:`)
      console.log(`  Position: ${a.currentPosition}`)
      console.log(`  Definitive: ${a.isDefinitive}`)
      console.log(`  Possible: ${a.possiblePositions.join(', ')}`)
    })

    // Find Silvana's analysis
    const silvana = result.analysis.find(a => a.coupleId === 'couple-silvana')
    const martin = result.analysis.find(a => a.coupleId === 'couple-martin')
    const jorge = result.analysis.find(a => a.coupleId === 'couple-jorge')

    // CRITICAL ASSERTIONS
    expect(jorge?.isDefinitive).toBe(true)  // Jorge IS definitive (1st place locked)
    expect(silvana?.isDefinitive).toBe(false) // ✅ FIX: Silvana is NOT definitive!
    expect(martin?.isDefinitive).toBe(false)  // Martin can change position

    // Silvana can be 2nd or 3rd
    expect(silvana?.possiblePositions).toContain(2)  // Could stay 2nd
    expect(silvana?.possiblePositions).toContain(3)  // Could drop to 3rd

    // Martin can be 2nd, 3rd, or 4th
    expect(martin?.possiblePositions.length).toBeGreaterThan(1)
  })

  it('should correctly simulate tiebreaker scenario: Martin 6-1 win', () => {
    /**
     * Manual tiebreaker simulation:
     * If Martin wins 6-1:
     * - Martin: 0W-1L → 1W-1L
     * - Martin games: 1+6=7 for, 6+1=7 against, diff = 0
     *
     * Ranking with both at 1W-1L:
     * - Silvana: -3 diff
     * - Martin: 0 diff
     *
     * Result: Martin > Silvana (better diff)
     */

    const silvanaDiff = -3
    const martinDiffAfterWin = 0  // (-5) + 5 from 6-1 win

    expect(martinDiffAfterWin).toBeGreaterThan(silvanaDiff)

    console.log('\n=== TIEBREAKER SIMULATION ===')
    console.log('Silvana: 1W-1L, diff =', silvanaDiff)
    console.log('Martin after 6-1 win: 1W-1L, diff =', martinDiffAfterWin)
    console.log('Winner:', martinDiffAfterWin > silvanaDiff ? 'Martin' : 'Silvana')
  })
})

// Helper function
function setupMockSupabase(
  mockSupabase: any,
  zoneId: string,
  positions: any[],
  pendingMatches: any[]
) {
  // Mock 1: zone_positions query
  mockSupabase.from.mockReturnValueOnce({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: positions,
          error: null
        })
      })
    })
  })

  // Mock 2: pending matches
  mockSupabase.from.mockReturnValueOnce({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        in: jest.fn().mockResolvedValue({
          data: pendingMatches,
          error: null
        })
      })
    })
  })

  // Mock 2.5: finished matches (nuevo)
  mockSupabase.from.mockReturnValueOnce({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          not: jest.fn().mockReturnValue({
            not: jest.fn().mockResolvedValue({
              data: [],  // No hay matches finalizados en este test
              error: null
            })
          })
        })
      })
    })
  })

  // Mock 3: zones query
  mockSupabase.from.mockReturnValueOnce({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { tournament_id: 'test-tournament' },
          error: null
        })
      })
    })
  })

  // Mock 4: tournaments query
  mockSupabase.from.mockReturnValueOnce({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { status: 'BRACKET_PHASE' },
          error: null
        })
      })
    })
  })

  // Mock 5+: Updates for each couple
  positions.forEach(() => {
    mockSupabase.from.mockReturnValueOnce({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      })
    })
  })
}
