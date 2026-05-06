/**
 * CASOS DE PRUEBA PARA ALGORITMO CORREGIDO DE POSICIONES DEFINITIVAS
 * 
 * Estos tests verifican que las correcciones implementadas funcionan correctamente:
 * 
 * ✅ ERRORES CORREGIDOS:
 * 1. "Si pareja no participa en pendientes → definitiva" (FALSO)
 * 2. Constraint analysis que solo mira la pareja target (INCOMPLETO)
 * 3. Fast validation que no considera efectos globales
 * 
 * ✅ ALGORITMO DE 3 NIVELES:
 * - NIVEL 1: Fast Validation (solo casos 100% seguros)
 * - NIVEL 2: Constraint Analysis Global (considera TODAS las parejas)
 * - NIVEL 3: Backtracking Selectivo (casos complejos)
 */

import { CorrectedDefinitiveAnalyzer } from '../corrected-definitive-analyzer'
import type { CoupleStats } from '../zone-position/types'

// Mock de Supabase para testing
jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({ data: [], error: null })),
          in: jest.fn(() => ({ data: [], error: null }))
        }))
      }))
    }))
  })
}))

// Mock del ZoneRankingEngine
jest.mock('../zone-position/zone-ranking-engine', () => ({
  ZoneRankingEngine: jest.fn().mockImplementation(() => ({
    rankCouplesByAllCriteria: jest.fn((couples) => {
      // Ranking simple por wins descendente, luego por games difference
      return couples.sort((a: any, b: any) => {
        if (a.matchesWon !== b.matchesWon) return b.matchesWon - a.matchesWon
        return b.gamesDifference - a.gamesDifference
      }).map((couple: any, index: number) => ({
        ...couple,
        position: index + 1
      }))
    })
  }))
}))

describe('CorrectedDefinitiveAnalyzer', () => {
  let analyzer: CorrectedDefinitiveAnalyzer

  beforeEach(() => {
    analyzer = new CorrectedDefinitiveAnalyzer()
    // Limpiar caché antes de cada test
    analyzer.clearCache()
  })

  afterEach(() => {
    analyzer.clearCache()
  })

  /**
   * TEST CASOS FAST VALIDATION CORREGIDOS
   */
  describe('NIVEL 1: Fast Validation Corregido', () => {
    
    test('✅ 1er lugar definitivo: 2W-0L cuando nadie más puede llegar a 2W', () => {
      const couples: CoupleStats[] = [
        createCouple('couple1', 2, 0, 12, 2, 1), // 2W-0L (líder)
        createCouple('couple2', 1, 2, 8, 10, 2), // 1W-2L (ya no puede llegar a 2W)
        createCouple('couple3', 0, 2, 3, 12, 3), // 0W-2L (ya no puede llegar a 2W)
        createCouple('couple4', 1, 1, 7, 8, 4)   // 1W-1L (puede llegar a 2W con 1 partido pendiente)
      ]

      const pendingMatches = [
        { id: 'match1', couple1_id: 'couple2', couple2_id: 'couple3', zone_id: 'zone1' }
        // couple4 NO tiene partidos pendientes, por lo que se queda en 1W
      ]

      // Simular análisis interno
      const result = (analyzer as any).checkCorrectedFastValidation(couples[0], couples, pendingMatches)
      
      expect(result.isDefinitive).toBe(true)
      expect(result.reason).toContain('2W-0L y ninguna otra pareja puede llegar a 2W')
    })

    test('✅ 4to lugar definitivo: 0W-2L cuando todos los demás pueden llegar a ≥1W', () => {
      const couples: CoupleStats[] = [
        createCouple('couple1', 2, 0, 12, 2, 1), // 2W-0L (ya tiene 1W)
        createCouple('couple2', 1, 1, 8, 8, 2),  // 1W-1L (ya tiene 1W)
        createCouple('couple3', 1, 1, 7, 9, 3),  // 1W-1L (ya tiene 1W)
        createCouple('couple4', 0, 2, 3, 12, 4)  // 0W-2L (último lugar)
      ]

      const pendingMatches = [
        { id: 'match1', couple1_id: 'couple2', couple2_id: 'couple3', zone_id: 'zone1' }
        // Todos los demás ya tienen 1W, couple4 no puede subir
      ]

      const result = (analyzer as any).checkCorrectedFastValidation(couples[3], couples, pendingMatches)
      
      expect(result.isDefinitive).toBe(true)
      expect(result.reason).toContain('0W-2L y todas las demás parejas pueden llegar a al menos 1W')
    })

    test('❌ ERROR CORREGIDO: "No participa en pendientes" NO implica definitiva', () => {
      const couples: CoupleStats[] = [
        createCouple('couple1', 1, 1, 8, 8, 1),  // 1W-1L (en empate)
        createCouple('couple2', 1, 1, 8, 8, 2),  // 1W-1L (en empate)
        createCouple('couple3', 1, 1, 7, 9, 3),  // 1W-1L (en empate)
        createCouple('couple4', 1, 1, 6, 10, 4)  // 1W-1L (NO participa en pendientes)
      ]

      const pendingMatches = [
        { id: 'match1', couple1_id: 'couple1', couple2_id: 'couple2', zone_id: 'zone1' },
        { id: 'match2', couple1_id: 'couple2', couple2_id: 'couple3', zone_id: 'zone1' }
        // couple4 NO participa en partidos pendientes
      ]

      const result = (analyzer as any).checkCorrectedFastValidation(couples[3], couples, pendingMatches)
      
      // ❌ ALGORITMO ANTERIOR ERRÓNEO: isDefinitive = true
      // ✅ ALGORITMO CORREGIDO: isDefinitive = false (el resultado de los otros partidos puede afectar su posición)
      expect(result.isDefinitive).toBe(false)
      expect(result.reason).toContain('Requiere análisis de constraints globales')
    })

    test('❌ 1er lugar NO definitivo: otros aún pueden llegar a 2W', () => {
      const couples: CoupleStats[] = [
        createCouple('couple1', 2, 0, 12, 2, 1), // 2W-0L (líder)
        createCouple('couple2', 1, 1, 8, 8, 2),  // 1W-1L (puede llegar a 2W)
        createCouple('couple3', 0, 2, 3, 12, 3), // 0W-2L
        createCouple('couple4', 1, 1, 7, 9, 4)   // 1W-1L (puede llegar a 2W)
      ]

      const pendingMatches = [
        { id: 'match1', couple1_id: 'couple2', couple2_id: 'couple3', zone_id: 'zone1' },
        { id: 'match2', couple1_id: 'couple4', couple2_id: 'couple3', zone_id: 'zone1' }
        // couple2 y couple4 pueden llegar a 2W ganando sus partidos
      ]

      const result = (analyzer as any).checkCorrectedFastValidation(couples[0], couples, pendingMatches)
      
      expect(result.isDefinitive).toBe(false)
      expect(result.reason).toContain('Requiere análisis de constraints globales')
    })
  })

  /**
   * TEST CONSTRAINT ANALYSIS GLOBAL
   */
  describe('NIVEL 2: Constraint Analysis Global', () => {
    
    test('✅ Considera efectos en TODAS las parejas, no solo target', async () => {
      // Escenario: parejas empempatadas pueden cambiar posiciones según resultados
      const couples: CoupleStats[] = [
        createCouple('couple1', 1, 1, 8, 8, 1),
        createCouple('couple2', 1, 1, 8, 8, 2),
        createCouple('couple3', 1, 1, 7, 9, 3),
        createCouple('couple4', 1, 1, 6, 10, 4)
      ]

      const pendingMatches = [
        { id: 'match1', couple1_id: 'couple1', couple2_id: 'couple3', zone_id: 'zone1' }
      ]

      // Mock fetchZoneData para este test
      jest.spyOn(analyzer as any, 'fetchZoneData').mockResolvedValue({
        couples,
        pendingMatches
      })

      const result = await (analyzer as any).performGlobalConstraintAnalysis(
        couples[1], // Analizar couple2 
        couples,
        pendingMatches
      )

      // couple2 no participa directamente, pero el resultado puede afectar su posición relativa
      expect(result.isDefinitive).toBe(false)
      expect(result.details).toContain('puede estar en posiciones')
      expect(result.scenariosProcessed).toBeGreaterThan(0)
    })

    test('✅ Detecta posición definitiva mediante análisis global', async () => {
      // Escenario donde fast validation falla pero constraint analysis detecta definitividad
      const couples: CoupleStats[] = [
        createCouple('couple1', 2, 0, 12, 4, 1), // 2W-0L, líder claro
        createCouple('couple2', 1, 1, 8, 8, 2),  // 1W-1L
        createCouple('couple3', 1, 1, 6, 10, 3), // 1W-1L
        createCouple('couple4', 0, 2, 2, 12, 4)  // 0W-2L
      ]

      const pendingMatches = [
        { id: 'match1', couple1_id: 'couple2', couple2_id: 'couple3', zone_id: 'zone1' }
        // Solo un partido entre couple2 y couple3, no puede afectar a couple1
      ]

      jest.spyOn(analyzer as any, 'fetchZoneData').mockResolvedValue({
        couples,
        pendingMatches
      })

      const result = await (analyzer as any).performGlobalConstraintAnalysis(
        couples[0], // Analizar couple1 (líder)
        couples,
        pendingMatches
      )

      // En todos los escenarios extremos, couple1 mantiene el 1er lugar
      expect(result.isDefinitive).toBe(true)
      expect(result.details).toContain('posición 1 es definitiva')
    })
  })

  /**
   * TEST BACKTRACKING SELECTIVO
   */
  describe('NIVEL 3: Backtracking Selectivo', () => {
    
    test('✅ Aplica límite de partidos pendientes (máximo 3)', async () => {
      const couples: CoupleStats[] = [
        createCouple('couple1', 1, 1, 8, 8, 1),
        createCouple('couple2', 1, 1, 8, 8, 2),
        createCouple('couple3', 1, 1, 7, 9, 3),
        createCouple('couple4', 1, 1, 6, 10, 4)
      ]

      // 4 partidos pendientes (excede el límite de 3)
      const pendingMatches = [
        { id: 'match1', couple1_id: 'couple1', couple2_id: 'couple2', zone_id: 'zone1' },
        { id: 'match2', couple1_id: 'couple1', couple2_id: 'couple3', zone_id: 'zone1' },
        { id: 'match3', couple1_id: 'couple2', couple2_id: 'couple4', zone_id: 'zone1' },
        { id: 'match4', couple1_id: 'couple3', couple2_id: 'couple4', zone_id: 'zone1' }
      ]

      const result = await (analyzer as any).performSelectiveBacktracking(
        couples[0],
        couples,
        pendingMatches
      )

      expect(result.isDefinitive).toBe(false)
      expect(result.details).toContain('Demasiados partidos pendientes (4)')
      expect(result.confidence).toBe(0.3) // Confianza baja por fallback conservador
      expect(result.scenariosProcessed).toBe(0) // No procesó escenarios
    })

    test('✅ Aplica límite de tiempo (5 segundos)', async () => {
      const couples: CoupleStats[] = [
        createCouple('couple1', 1, 1, 8, 8, 1),
        createCouple('couple2', 1, 1, 8, 8, 2),
        createCouple('couple3', 1, 1, 7, 9, 3),
        createCouple('couple4', 1, 1, 6, 10, 4)
      ]

      // 3 partidos (dentro del límite)
      const pendingMatches = [
        { id: 'match1', couple1_id: 'couple1', couple2_id: 'couple2', zone_id: 'zone1' },
        { id: 'match2', couple1_id: 'couple2', couple2_id: 'couple3', zone_id: 'zone1' },
        { id: 'match3', couple1_id: 'couple3', couple2_id: 'couple4', zone_id: 'zone1' }
      ]

      // Mock de simulación lenta para activar timeout
      jest.spyOn(analyzer as any, 'simulateZoneWithOutcomes').mockImplementation(() => {
        // Simular 10ms por simulación para forzar timeout
        const start = Date.now()
        while (Date.now() - start < 10) {} // Busy wait
        return couples.map((c, i) => ({ ...c, position: i + 1 }))
      })

      const result = await (analyzer as any).performSelectiveBacktracking(
        couples[0],
        couples,
        pendingMatches
      )

      // Debería activar el timeout y usar fallback conservador
      expect(result.details).toMatch(/Límite de tiempo alcanzado|Backtracking selectivo/)
      expect(result.confidence).toBeLessThanOrEqual(0.8)
    })

    test('✅ Análisis completo exitoso con pocos partidos', async () => {
      const couples: CoupleStats[] = [
        createCouple('couple1', 2, 0, 12, 4, 1), // Claramente 1er lugar
        createCouple('couple2', 1, 1, 8, 8, 2),
        createCouple('couple3', 1, 1, 6, 10, 3),
        createCouple('couple4', 0, 2, 2, 12, 4)
      ]

      // Solo 1 partido pendiente
      const pendingMatches = [
        { id: 'match1', couple1_id: 'couple2', couple2_id: 'couple3', zone_id: 'zone1' }
      ]

      const result = await (analyzer as any).performSelectiveBacktracking(
        couples[0], // Analizar líder
        couples,
        pendingMatches
      )

      expect(result.isDefinitive).toBe(true)
      expect(result.possiblePositions).toEqual([1])
      expect(result.confidence).toBe(1.0)
      expect(result.scenariosProcessed).toBeGreaterThan(0)
      expect(result.totalScenarios).toBeGreaterThan(0)
    })
  })

  /**
   * TEST INTEGRACIÓN COMPLETA
   */
  describe('Integración Completa del Algoritmo de 3 Niveles', () => {
    
    test('✅ Fast Validation tiene prioridad sobre otros niveles', async () => {
      const couples: CoupleStats[] = [
        createCouple('couple1', 2, 0, 12, 2, 1), // 2W-0L definitivo
        createCouple('couple2', 1, 2, 8, 10, 2),
        createCouple('couple3', 0, 2, 3, 12, 3),
        createCouple('couple4', 1, 1, 7, 9, 4)
      ]

      const pendingMatches = [
        { id: 'match1', couple1_id: 'couple4', couple2_id: 'couple3', zone_id: 'zone1' }
      ]

      // Mock fetchZoneData
      jest.spyOn(analyzer as any, 'fetchZoneData').mockResolvedValue({
        couples,
        pendingMatches
      })

      const result = await (analyzer as any).analyzePositionWithThreeLevels(
        couples[0], // couple1 - 2W-0L
        couples,
        pendingMatches
      )

      expect(result.analysisMethod).toBe('FAST_VALIDATION')
      expect(result.isDefinitive).toBe(true)
      expect(result.confidence).toBe(1.0)
    })

    test('✅ Fallback desde Fast Validation a Constraint Analysis', async () => {
      const couples: CoupleStats[] = [
        createCouple('couple1', 1, 1, 8, 8, 1), // Empate complejo
        createCouple('couple2', 1, 1, 8, 8, 2),
        createCouple('couple3', 1, 1, 7, 9, 3),
        createCouple('couple4', 1, 1, 6, 10, 4)
      ]

      const pendingMatches = [
        { id: 'match1', couple1_id: 'couple1', couple2_id: 'couple2', zone_id: 'zone1' }
      ]

      jest.spyOn(analyzer as any, 'fetchZoneData').mockResolvedValue({
        couples,
        pendingMatches
      })

      const result = await (analyzer as any).analyzePositionWithThreeLevels(
        couples[2], // couple3 - en empate
        couples,
        pendingMatches
      )

      // Debería usar Constraint Analysis o Backtracking, no Fast Validation
      expect(result.analysisMethod).toMatch(/CONSTRAINT_ANALYSIS_GLOBAL|BACKTRACKING_SELECTIVE/)
      expect(result.confidence).toBeGreaterThan(0)
    })
  })

  /**
   * TEST PERFORMANCE Y CACHÉ
   */
  describe('Performance y Caché', () => {
    
    test('✅ Sistema de caché funciona correctamente', async () => {
      const couples: CoupleStats[] = [
        createCouple('couple1', 1, 1, 8, 8, 1),
        createCouple('couple2', 1, 1, 8, 8, 2)
      ]

      const pendingMatches = [
        { id: 'match1', couple1_id: 'couple1', couple2_id: 'couple2', zone_id: 'zone1' }
      ]

      // Primera simulación
      const result1 = (analyzer as any).simulateZoneWithOutcomes(couples, pendingMatches, [
        { matchId: 'match1', couple1Id: 'couple1', couple2Id: 'couple2', couple1Games: 6, couple2Games: 4, winnerId: 'couple1' }
      ])

      // Segunda simulación con los mismos parámetros (debería usar caché)
      const result2 = (analyzer as any).simulateZoneWithOutcomes(couples, pendingMatches, [
        { matchId: 'match1', couple1Id: 'couple1', couple2Id: 'couple2', couple1Games: 6, couple2Games: 4, winnerId: 'couple1' }
      ])

      expect(result1).toEqual(result2)
      
      const metrics = analyzer.getPerformanceMetrics()
      expect(metrics.cacheHits).toBeGreaterThan(0)
    })

    test('✅ Limpieza de caché funciona', () => {
      // Agregar algo al caché primero
      (analyzer as any).simulationCache.set('test', [])
      
      expect(analyzer.getPerformanceMetrics().cacheSize).toBeGreaterThan(0)
      
      analyzer.clearCache()
      
      const metrics = analyzer.getPerformanceMetrics()
      expect(metrics.cacheSize).toBe(0)
      expect(metrics.cacheHits).toBe(0)
      expect(metrics.totalSimulations).toBe(0)
    })
  })
})

/**
 * UTILIDADES PARA TESTING
 */
function createCouple(
  id: string, 
  wins: number, 
  losses: number, 
  gamesWon: number, 
  gamesLost: number, 
  position: number
): CoupleStats {
  return {
    coupleId: id,
    player1Name: `Player1-${id}`,
    player2Name: `Player2-${id}`,
    position,
    matchesWon: wins,
    matchesLost: losses,
    matchesPlayed: wins + losses,
    gamesWon,
    gamesLost,
    gamesDifference: gamesWon - gamesLost,
    totalPlayerScore: 0,
    positionTieInfo: '',
    player1Score: 0,
    player2Score: 0,
    setsWon: 0,
    setsLost: 0,
    setsDifference: 0
  }
}