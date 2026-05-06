/**
 * DEFINITIVE POSITION TEST CASES
 * 
 * Casos de prueba específicos para validar el algoritmo de posiciones definitivas.
 * Incluye escenarios edge cases y casos típicos del mundo real.
 */

import { OptimizedDefinitiveAnalyzer } from '../optimized-definitive-analyzer'
import type { CoupleStats } from '../zone-position/types'

// ============================================================================
// TEST DATA BUILDERS
// ============================================================================

interface TestCouple {
  id: string
  name: string
  wins: number
  losses: number
  gamesFor: number
  gamesAgainst: number
  playerScore: number
}

interface TestMatch {
  id: string
  couple1: string
  couple2: string
}

function buildCoupleStats(couples: TestCouple[]): CoupleStats[] {
  return couples.map((couple, index) => ({
    coupleId: couple.id,
    player1Name: couple.name,
    player2Name: couple.name,
    position: index + 1,
    matchesWon: couple.wins,
    matchesLost: couple.losses,
    matchesPlayed: couple.wins + couple.losses,
    gamesWon: couple.gamesFor,
    gamesLost: couple.gamesAgainst,
    gamesDifference: couple.gamesFor - couple.gamesAgainst,
    totalPlayerScore: couple.playerScore,
    positionTieInfo: '',
    // Required fields
    player1Score: 0,
    player2Score: 0,
    setsWon: 0,
    setsLost: 0,
    setsDifference: 0
  }))
}

function buildPendingMatches(matches: TestMatch[]) {
  return matches.map(match => ({
    id: match.id,
    couple1_id: match.couple1,
    couple2_id: match.couple2,
    zone_id: 'test-zone'
  }))
}

// ============================================================================
// TEST CASES
// ============================================================================

export const DEFINITIVE_POSITION_TEST_CASES = {
  
  /**
   * CASO 1: ZONA COMPLETA - TODAS LAS POSICIONES DEFINITIVAS
   */
  COMPLETE_ZONE: {
    name: "Zona completa - 0 partidos pendientes",
    couples: buildCoupleStats([
      { id: 'A', name: 'Pareja A', wins: 3, losses: 0, gamesFor: 18, gamesAgainst: 6, playerScore: 1200 },
      { id: 'B', name: 'Pareja B', wins: 2, losses: 1, gamesFor: 15, gamesAgainst: 9, playerScore: 1100 },
      { id: 'C', name: 'Pareja C', wins: 1, losses: 2, gamesFor: 12, gamesAgainst: 15, playerScore: 1000 },
      { id: 'D', name: 'Pareja D', wins: 0, losses: 3, gamesFor: 3, gamesAgainst: 18, playerScore: 900 }
    ]),
    pendingMatches: buildPendingMatches([]),
    expectedResults: {
      'A': { isDefinitive: true, possiblePositions: [1] },
      'B': { isDefinitive: true, possiblePositions: [2] },
      'C': { isDefinitive: true, possiblePositions: [3] },
      'D': { isDefinitive: true, possiblePositions: [4] }
    },
    expectedMethod: 'NO_PENDING_MATCHES'
  },

  /**
   * CASO 2: 1ER LUGAR DEFINITIVO POR FAST VALIDATION
   */
  FIRST_PLACE_DEFINITIVE: {
    name: "1er lugar definitivo - 2W-0L vs otras con losses",
    couples: buildCoupleStats([
      { id: 'A', name: 'Pareja A', wins: 2, losses: 0, gamesFor: 12, gamesAgainst: 3, playerScore: 1200 },
      { id: 'B', name: 'Pareja B', wins: 1, losses: 1, gamesFor: 9, gamesAgainst: 6, playerScore: 1100 },
      { id: 'C', name: 'Pareja C', wins: 1, losses: 1, gamesFor: 8, gamesAgainst: 7, playerScore: 1000 },
      { id: 'D', name: 'Pareja D', wins: 0, losses: 2, gamesFor: 4, gamesAgainst: 12, playerScore: 900 }
    ]),
    pendingMatches: buildPendingMatches([
      { id: 'match1', couple1: 'B', couple2: 'C' },
      { id: 'match2', couple1: 'B', couple2: 'D' },
      { id: 'match3', couple1: 'C', couple2: 'D' }
    ]),
    expectedResults: {
      'A': { isDefinitive: true, possiblePositions: [1] },
      'B': { isDefinitive: false, possiblePositions: [2, 3] },
      'C': { isDefinitive: false, possiblePositions: [2, 3] },
      'D': { isDefinitive: false, possiblePositions: [3, 4] }
    },
    expectedMethod: 'FAST_VALIDATION'
  },

  /**
   * CASO 3: 4TO LUGAR DEFINITIVO POR FAST VALIDATION
   */
  FOURTH_PLACE_DEFINITIVE: {
    name: "4to lugar definitivo - 0W-2L vs otras con wins",
    couples: buildCoupleStats([
      { id: 'A', name: 'Pareja A', wins: 2, losses: 0, gamesFor: 12, gamesAgainst: 3, playerScore: 1200 },
      { id: 'B', name: 'Pareja B', wins: 1, losses: 1, gamesFor: 9, gamesAgainst: 6, playerScore: 1100 },
      { id: 'C', name: 'Pareja C', wins: 1, losses: 1, gamesFor: 8, gamesAgainst: 7, playerScore: 1000 },
      { id: 'D', name: 'Pareja D', wins: 0, losses: 2, gamesFor: 2, gamesAgainst: 12, playerScore: 900 }
    ]),
    pendingMatches: buildPendingMatches([
      { id: 'match1', couple1: 'A', couple2: 'B' },
      { id: 'match2', couple1: 'A', couple2: 'C' },
      { id: 'match3', couple1: 'B', couple2: 'C' }
    ]),
    expectedResults: {
      'A': { isDefinitive: false, possiblePositions: [1] },
      'B': { isDefinitive: false, possiblePositions: [2, 3] },
      'C': { isDefinitive: false, possiblePositions: [2, 3] },
      'D': { isDefinitive: true, possiblePositions: [4] }
    },
    expectedMethod: 'FAST_VALIDATION'
  },

  /**
   * CASO 4: EMPATE COMPLEJO - REQUIERE BACKTRACKING
   */
  COMPLEX_TIE: {
    name: "Empate complejo - múltiples escenarios posibles",
    couples: buildCoupleStats([
      { id: 'A', name: 'Pareja A', wins: 1, losses: 1, gamesFor: 8, gamesAgainst: 7, playerScore: 1000 },
      { id: 'B', name: 'Pareja B', wins: 1, losses: 1, gamesFor: 7, gamesAgainst: 8, playerScore: 1000 },
      { id: 'C', name: 'Pareja C', wins: 1, losses: 1, gamesFor: 8, gamesAgainst: 8, playerScore: 1000 },
      { id: 'D', name: 'Pareja D', wins: 1, losses: 1, gamesFor: 7, gamesAgainst: 7, playerScore: 1000 }
    ]),
    pendingMatches: buildPendingMatches([
      { id: 'match1', couple1: 'A', couple2: 'D' },
      { id: 'match2', couple1: 'B', couple2: 'C' }
    ]),
    expectedResults: {
      'A': { isDefinitive: false, possiblePositions: [1, 2, 3, 4] },
      'B': { isDefinitive: false, possiblePositions: [1, 2, 3, 4] },
      'C': { isDefinitive: false, possiblePositions: [1, 2, 3, 4] },
      'D': { isDefinitive: false, possiblePositions: [1, 2, 3, 4] }
    },
    expectedMethod: 'BACKTRACKING_FULL'
  },

  /**
   * CASO 5: PAREJA NO PARTICIPA EN PENDIENTES
   */
  NON_PARTICIPANT: {
    name: "Pareja completa sus 3 partidos, otros pendientes",
    couples: buildCoupleStats([
      { id: 'A', name: 'Pareja A', wins: 3, losses: 0, gamesFor: 18, gamesAgainst: 6, playerScore: 1200 },
      { id: 'B', name: 'Pareja B', wins: 1, losses: 2, gamesFor: 12, gamesAgainst: 15, playerScore: 1100 },
      { id: 'C', name: 'Pareja C', wins: 1, losses: 1, gamesFor: 9, gamesAgainst: 9, playerScore: 1000 },
      { id: 'D', name: 'Pareja D', wins: 1, losses: 1, gamesFor: 8, gamesAgainst: 10, playerScore: 900 }
    ]),
    pendingMatches: buildPendingMatches([
      { id: 'match1', couple1: 'C', couple2: 'D' }
    ]),
    expectedResults: {
      'A': { isDefinitive: true, possiblePositions: [1] },
      'B': { isDefinitive: true, possiblePositions: [4] },
      'C': { isDefinitive: false, possiblePositions: [2, 3] },
      'D': { isDefinitive: false, possiblePositions: [2, 3] }
    },
    expectedMethod: 'FAST_VALIDATION'
  },

  /**
   * CASO 6: CONSTRAINT ANALYSIS - RANGO LIMITADO
   */
  LIMITED_RANGE: {
    name: "Análisis por restricciones - rango limitado",
    couples: buildCoupleStats([
      { id: 'A', name: 'Pareja A', wins: 2, losses: 1, gamesFor: 15, gamesAgainst: 9, playerScore: 1200 },
      { id: 'B', name: 'Pareja B', wins: 2, losses: 1, gamesFor: 14, gamesAgainst: 10, playerScore: 1100 },
      { id: 'C', name: 'Pareja C', wins: 1, losses: 2, gamesFor: 10, gamesAgainst: 14, playerScore: 1000 },
      { id: 'D', name: 'Pareja D', wins: 1, losses: 2, gamesFor: 9, gamesAgainst: 15, playerScore: 900 }
    ]),
    pendingMatches: buildPendingMatches([
      { id: 'match1', couple1: 'C', couple2: 'D' }
    ]),
    expectedResults: {
      'A': { isDefinitive: false, possiblePositions: [1, 2] },
      'B': { isDefinitive: false, possiblePositions: [1, 2] },
      'C': { isDefinitive: false, possiblePositions: [3, 4] },
      'D': { isDefinitive: false, possiblePositions: [3, 4] }
    },
    expectedMethod: 'CONSTRAINT_ANALYSIS'
  },

  /**
   * CASO 7: ZONA DE 3 PAREJAS
   */
  THREE_COUPLES_ZONE: {
    name: "Zona con 3 parejas - estructura especial",
    couples: buildCoupleStats([
      { id: 'A', name: 'Pareja A', wins: 2, losses: 0, gamesFor: 12, gamesAgainst: 4, playerScore: 1200 },
      { id: 'B', name: 'Pareja B', wins: 1, losses: 1, gamesFor: 8, gamesAgainst: 8, playerScore: 1100 },
      { id: 'C', name: 'Pareja C', wins: 0, losses: 2, gamesFor: 4, gamesAgainst: 12, playerScore: 1000 }
    ]),
    pendingMatches: buildPendingMatches([]),
    expectedResults: {
      'A': { isDefinitive: true, possiblePositions: [1] },
      'B': { isDefinitive: true, possiblePositions: [2] },
      'C': { isDefinitive: true, possiblePositions: [3] }
    },
    expectedMethod: 'NO_PENDING_MATCHES'
  },

  /**
   * CASO 8: EMPATE PERFECTO - TODOS LOS CRITERIOS IGUALES
   */
  PERFECT_TIE: {
    name: "Empate perfecto - requiere random tiebreaker",
    couples: buildCoupleStats([
      { id: 'A', name: 'Pareja A', wins: 1, losses: 1, gamesFor: 8, gamesAgainst: 8, playerScore: 1000 },
      { id: 'B', name: 'Pareja B', wins: 1, losses: 1, gamesFor: 8, gamesAgainst: 8, playerScore: 1000 },
      { id: 'C', name: 'Pareja C', wins: 1, losses: 1, gamesFor: 8, gamesAgainst: 8, playerScore: 1000 },
      { id: 'D', name: 'Pareja D', wins: 1, losses: 1, gamesFor: 8, gamesAgainst: 8, playerScore: 1000 }
    ]),
    pendingMatches: buildPendingMatches([]),
    expectedResults: {
      'A': { isDefinitive: true, possiblePositions: [1, 2, 3, 4] }, // Cualquier posición por random
      'B': { isDefinitive: true, possiblePositions: [1, 2, 3, 4] },
      'C': { isDefinitive: true, possiblePositions: [1, 2, 3, 4] },
      'D': { isDefinitive: true, possiblePositions: [1, 2, 3, 4] }
    },
    expectedMethod: 'NO_PENDING_MATCHES'
  },

  /**
   * CASO 9: MUCHOS PARTIDOS PENDIENTES - PERFORMANCE TEST
   */
  MANY_PENDING_MATCHES: {
    name: "Zona inicial - muchos partidos pendientes",
    couples: buildCoupleStats([
      { id: 'A', name: 'Pareja A', wins: 0, losses: 0, gamesFor: 0, gamesAgainst: 0, playerScore: 1000 },
      { id: 'B', name: 'Pareja B', wins: 0, losses: 0, gamesFor: 0, gamesAgainst: 0, playerScore: 1000 },
      { id: 'C', name: 'Pareja C', wins: 0, losses: 0, gamesFor: 0, gamesAgainst: 0, playerScore: 1000 },
      { id: 'D', name: 'Pareja D', wins: 0, losses: 0, gamesFor: 0, gamesAgainst: 0, playerScore: 1000 }
    ]),
    pendingMatches: buildPendingMatches([
      { id: 'match1', couple1: 'A', couple2: 'B' },
      { id: 'match2', couple1: 'A', couple2: 'C' },
      { id: 'match3', couple1: 'A', couple2: 'D' },
      { id: 'match4', couple1: 'B', couple2: 'C' },
      { id: 'match5', couple1: 'B', couple2: 'D' },
      { id: 'match6', couple1: 'C', couple2: 'D' }
    ]),
    expectedResults: {
      'A': { isDefinitive: false, possiblePositions: [1, 2, 3, 4] },
      'B': { isDefinitive: false, possiblePositions: [1, 2, 3, 4] },
      'C': { isDefinitive: false, possiblePositions: [1, 2, 3, 4] },
      'D': { isDefinitive: false, possiblePositions: [1, 2, 3, 4] }
    },
    expectedMethod: 'BACKTRACKING_LIMITED' // Likely to hit time/scenario limits
  },

  /**
   * CASO 10: EDGE CASE - UNA PAREJA CON VENTAJA CLARA
   */
  CLEAR_LEADER: {
    name: "Líder claro - otras parejas en empate",
    couples: buildCoupleStats([
      { id: 'A', name: 'Pareja A', wins: 2, losses: 0, gamesFor: 12, gamesAgainst: 2, playerScore: 1200 },
      { id: 'B', name: 'Pareja B', wins: 0, losses: 1, gamesFor: 4, gamesAgainst: 6, playerScore: 1000 },
      { id: 'C', name: 'Pareja C', wins: 0, losses: 1, gamesFor: 3, gamesAgainst: 6, playerScore: 1000 },
      { id: 'D', name: 'Pareja D', wins: 0, losses: 0, gamesFor: 0, gamesAgainst: 0, playerScore: 1000 }
    ]),
    pendingMatches: buildPendingMatches([
      { id: 'match1', couple1: 'A', couple2: 'D' },
      { id: 'match2', couple1: 'B', couple2: 'D' },
      { id: 'match3', couple1: 'C', couple2: 'D' }
    ]),
    expectedResults: {
      'A': { isDefinitive: false, possiblePositions: [1] }, // Muy probable 1ro pero no definitivo hasta completar
      'B': { isDefinitive: false, possiblePositions: [2, 3, 4] },
      'C': { isDefinitive: false, possiblePositions: [2, 3, 4] },
      'D': { isDefinitive: false, possiblePositions: [1, 2, 3, 4] } // Puede ganar todos
    },
    expectedMethod: 'BACKTRACKING_FULL'
  }
}

// ============================================================================
// TEST RUNNER
// ============================================================================

export async function runDefinitivePositionTests() {
  console.log('🧪 [TEST] Starting definitive position tests...')
  
  const analyzer = new OptimizedDefinitiveAnalyzer()
  const results: { [key: string]: any } = {}
  
  for (const [testName, testCase] of Object.entries(DEFINITIVE_POSITION_TEST_CASES)) {
    console.log(`\n🔍 [TEST] Running: ${testCase.name}`)
    
    try {
      const startTime = performance.now()
      
      // Create mock zone data
      const mockZoneData = {
        couples: testCase.couples,
        pendingMatches: testCase.pendingMatches,
        zoneName: `Test Zone - ${testName}`
      }
      
      // Mock the fetchZoneData method
      const originalFetch = (analyzer as any).fetchZoneData
      ;(analyzer as any).fetchZoneData = async (zoneId: string) => mockZoneData
      
      // Run analysis
      const result = await analyzer.analyzeZoneOptimized('test-zone-id')
      
      // Restore original method
      ;(analyzer as any).fetchZoneData = originalFetch
      
      const executionTime = performance.now() - startTime
      
      // Validate results
      const validationResults = validateTestResults(testCase, result)
      
      results[testName] = {
        success: validationResults.success,
        executionTimeMs: Math.round(executionTime),
        analysisResults: result,
        validationErrors: validationResults.errors,
        performanceMetrics: {
          analysisTimeMs: result.analysisTimeMs,
          optimizationsSaved: result.optimizationsSaved.length
        }
      }
      
      if (validationResults.success) {
        console.log(`✅ [TEST] ${testName}: PASSED (${Math.round(executionTime)}ms)`)
      } else {
        console.log(`❌ [TEST] ${testName}: FAILED`)
        console.log(`   Errors: ${validationResults.errors.join(', ')}`)
      }
      
    } catch (error: any) {
      console.log(`💥 [TEST] ${testName}: ERROR - ${error.message}`)
      results[testName] = {
        success: false,
        error: error.message
      }
    }
  }
  
  // Summary
  const passed = Object.values(results).filter(r => r.success).length
  const total = Object.keys(results).length
  
  console.log(`\n📊 [TEST] Summary: ${passed}/${total} tests passed`)
  
  if (passed === total) {
    console.log(`🎉 [TEST] All tests passed!`)
  } else {
    console.log(`⚠️ [TEST] ${total - passed} tests failed`)
  }
  
  return results
}

function validateTestResults(testCase: any, actualResult: any): { success: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check if all couples were analyzed
  const expectedCouples = testCase.couples.map((c: any) => c.coupleId)
  const actualCouples = actualResult.positionAnalyses.map((a: any) => a.coupleId)
  
  for (const expectedCouple of expectedCouples) {
    if (!actualCouples.includes(expectedCouple)) {
      errors.push(`Missing analysis for couple ${expectedCouple}`)
    }
  }
  
  // Check specific results
  for (const [coupleId, expected] of Object.entries(testCase.expectedResults)) {
    const actual = actualResult.positionAnalyses.find((a: any) => a.coupleId === coupleId)
    
    if (!actual) {
      errors.push(`No analysis found for couple ${coupleId}`)
      continue
    }
    
    const exp = expected as any
    
    // Check if definitive matches
    if (actual.isDefinitive !== exp.isDefinitive) {
      errors.push(`Couple ${coupleId}: expected isDefinitive=${exp.isDefinitive}, got ${actual.isDefinitive}`)
    }
    
    // Check possible positions (if specified)
    if (exp.possiblePositions && exp.possiblePositions.length > 0) {
      const actualPositions = actual.possiblePositions.sort()
      const expectedPositions = exp.possiblePositions.sort()
      
      if (JSON.stringify(actualPositions) !== JSON.stringify(expectedPositions)) {
        errors.push(`Couple ${coupleId}: expected positions ${expectedPositions.join(',')}, got ${actualPositions.join(',')}`)
      }
    }
  }
  
  // Check expected method (if all couples use same method)
  if (testCase.expectedMethod) {
    const methods = actualResult.positionAnalyses.map((a: any) => a.analysisMethod)
    const uniqueMethods = [...new Set(methods)]
    
    if (uniqueMethods.length === 1 && uniqueMethods[0] !== testCase.expectedMethod) {
      errors.push(`Expected method ${testCase.expectedMethod}, got ${uniqueMethods[0]}`)
    }
  }
  
  return {
    success: errors.length === 0,
    errors
  }
}

// Performance benchmark
export async function benchmarkDefinitiveAnalysis() {
  console.log('🚀 [BENCHMARK] Starting performance benchmark...')
  
  const analyzer = new OptimizedDefinitiveAnalyzer()
  const iterations = 100
  const results: number[] = []
  
  // Use the complex tie case for benchmarking
  const testCase = DEFINITIVE_POSITION_TEST_CASES.COMPLEX_TIE
  
  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now()
    
    // Mock the fetchZoneData method
    ;(analyzer as any).fetchZoneData = async () => ({
      couples: testCase.couples,
      pendingMatches: testCase.pendingMatches,
      zoneName: 'Benchmark Zone'
    })
    
    await analyzer.analyzeZoneOptimized('benchmark-zone')
    
    const executionTime = performance.now() - startTime
    results.push(executionTime)
  }
  
  const avg = results.reduce((sum, time) => sum + time, 0) / results.length
  const min = Math.min(...results)
  const max = Math.max(...results)
  const p95 = results.sort((a, b) => a - b)[Math.floor(results.length * 0.95)]
  
  console.log('📈 [BENCHMARK] Results:')
  console.log(`  Average: ${avg.toFixed(2)}ms`)
  console.log(`  Min: ${min.toFixed(2)}ms`)
  console.log(`  Max: ${max.toFixed(2)}ms`)
  console.log(`  P95: ${p95.toFixed(2)}ms`)
  
  return { avg, min, max, p95 }
}