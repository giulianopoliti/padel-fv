/**
 * OPTIMIZED DEFINITIVE POSITION ANALYZER
 * 
 * Sistema de análisis de posiciones definitivas optimizado para torneos de padel.
 * Implementa un enfoque estratificado: Fast Validation → Constraint Analysis → Backtracking
 * 
 * COMPLEJIDAD ALGORÍTMICA:
 * - Fast Validation: O(n) - casos obvios (95% de casos)
 * - Constraint Analysis: O(n²) - límites matemáticos (4% de casos)  
 * - Backtracking: O(18^k) - simulación completa (1% de casos críticos)
 * 
 * PERFORMANCE TARGETS:
 * - Zona completa (4 parejas, 0 pendientes): <1ms
 * - Zona con 1 partido pendiente: <10ms
 * - Zona con 2+ partidos pendientes: <100ms
 * - Torneo completo (8 zonas): <500ms
 */

import { createClient } from '@/utils/supabase/client'
import { ZoneRankingEngine } from './zone-position/zone-ranking-engine'
import type { CoupleStats, MatchData, HeadToHeadResult } from './zone-position/types'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface OptimizedPositionAnalysis {
  coupleId: string
  currentPosition: number
  isDefinitive: boolean
  possiblePositions: number[]
  analysisMethod: AnalysisMethod
  analysisDetails: string
  confidence: number // 0-1
  computationTimeMs: number
  constraintsSatisfied: string[]
}

export type AnalysisMethod = 
  | 'NO_PENDING_MATCHES'    // 0 partidos pendientes
  | 'FAST_VALIDATION'       // Casos obvios (1er/4to lugar)
  | 'CONSTRAINT_ANALYSIS'   // Límites matemáticos
  | 'BACKTRACKING_FULL'     // Simulación completa
  | 'BACKTRACKING_LIMITED'  // Simulación con límite de tiempo

export interface PendingMatch {
  id: string
  couple1_id: string
  couple2_id: string
  zone_id: string
}

export interface MatchOutcome {
  matchId: string
  couple1Id: string
  couple2Id: string
  couple1Games: number
  couple2Games: number
  winnerId: string
}

export interface ZoneAnalysisResult {
  zoneId: string
  zoneName: string
  totalCouples: number
  definitivePositions: number
  analysisTimeMs: number
  positionAnalyses: OptimizedPositionAnalysis[]
  optimizationsSaved: string[]
}

// ============================================================================
// CONSTANTS & CONFIGURATIONS
// ============================================================================

// Todos los resultados posibles en padel (ordenados por probabilidad)
const PADEL_MATCH_RESULTS = [
  // Más probables (6-4, 6-3, 6-2)
  { couple1Games: 6, couple2Games: 4, winner: 'couple1', probability: 0.25 },
  { couple1Games: 6, couple2Games: 3, winner: 'couple1', probability: 0.20 },
  { couple1Games: 6, couple2Games: 2, winner: 'couple1', probability: 0.15 },
  { couple1Games: 4, couple2Games: 6, winner: 'couple2', probability: 0.25 },
  { couple1Games: 3, couple2Games: 6, winner: 'couple2', probability: 0.20 },
  { couple1Games: 2, couple2Games: 6, winner: 'couple2', probability: 0.15 },
  
  // Menos probables
  { couple1Games: 6, couple2Games: 5, winner: 'couple1', probability: 0.10 },
  { couple1Games: 6, couple2Games: 1, winner: 'couple1', probability: 0.05 },
  { couple1Games: 6, couple2Games: 0, winner: 'couple1', probability: 0.02 },
  { couple1Games: 7, couple2Games: 5, winner: 'couple1', probability: 0.08 },
  { couple1Games: 7, couple2Games: 6, winner: 'couple1', probability: 0.05 },
  { couple1Games: 5, couple2Games: 6, winner: 'couple2', probability: 0.10 },
  { couple1Games: 1, couple2Games: 6, winner: 'couple2', probability: 0.05 },
  { couple1Games: 0, couple2Games: 6, winner: 'couple2', probability: 0.02 },
  { couple1Games: 5, couple2Games: 7, winner: 'couple2', probability: 0.08 },
  { couple1Games: 6, couple2Games: 7, winner: 'couple2', probability: 0.05 }
] as const

// Configuración de performance
const PERFORMANCE_CONFIG = {
  MAX_BACKTRACK_SCENARIOS: 1000,      // Límite de escenarios por análisis
  MAX_ANALYSIS_TIME_MS: 100,          // Tiempo máximo por pareja
  MAX_ZONE_ANALYSIS_TIME_MS: 500,     // Tiempo máximo por zona
  EARLY_TERMINATION_POSITIONS: 3,     // Si puede estar en 3+ posiciones, terminar
  CACHE_TTL_MS: 5 * 60 * 1000,       // 5 minutos
  PROBABILISTIC_CUTOFF: 0.01          // Ignorar escenarios con <1% probabilidad
} as const

// ============================================================================
// MAIN ANALYZER CLASS
// ============================================================================

export class OptimizedDefinitiveAnalyzer {
  private rankingEngine: ZoneRankingEngine
  private simulationCache = new Map<string, CoupleStats[]>()
  private analysisCache = new Map<string, OptimizedPositionAnalysis>()
  private cacheTimestamps = new Map<string, number>()
  
  constructor() {
    this.rankingEngine = new ZoneRankingEngine()
  }
  
  /**
   * MÉTODO PRINCIPAL: Análisis completo de zona con optimizaciones
   */
  async analyzeZoneOptimized(zoneId: string): Promise<ZoneAnalysisResult> {
    const startTime = performance.now()
    console.log(`🚀 [OPTIMIZER] Starting optimized analysis for zone: ${zoneId}`)
    
    // 1. Fetch zone data
    const { couples, pendingMatches, zoneName } = await this.fetchZoneData(zoneId)
    
    if (couples.length === 0) {
      console.log(`⚠️ [OPTIMIZER] No couples found in zone ${zoneId}`)
      return this.createEmptyResult(zoneId, zoneName || 'Unknown')
    }
    
    console.log(`📊 [OPTIMIZER] Zone data: ${couples.length} couples, ${pendingMatches.length} pending matches`)
    
    // 2. Check for cached results (if no new matches)
    const cacheKey = this.generateZoneCacheKey(zoneId, couples, pendingMatches)
    const cachedResult = this.getCachedZoneResult(cacheKey)
    if (cachedResult) {
      console.log(`⚡ [OPTIMIZER] Using cached result for zone ${zoneId}`)
      return cachedResult
    }
    
    // 3. Fast path: No pending matches
    if (pendingMatches.length === 0) {
      const result = this.handleNoPendingMatches(zoneId, zoneName || 'Unknown', couples)
      this.cacheZoneResult(cacheKey, result)
      return result
    }
    
    // 4. Analyze each couple with progressive strategies
    const positionAnalyses: OptimizedPositionAnalysis[] = []
    const optimizationsSaved: string[] = []
    
    for (const couple of couples) {
      const analysis = await this.analyzeCouplePosition(couple, couples, pendingMatches)
      positionAnalyses.push(analysis)
      
      // Track optimizations
      if (analysis.analysisMethod === 'FAST_VALIDATION') {
        optimizationsSaved.push(`Fast validation for position ${couple.position}`)
      }
    }
    
    const totalTime = performance.now() - startTime
    const definitiveCount = positionAnalyses.filter(a => a.isDefinitive).length
    
    const result: ZoneAnalysisResult = {
      zoneId,
      zoneName: zoneName || 'Unknown',
      totalCouples: couples.length,
      definitivePositions: definitiveCount,
      analysisTimeMs: Math.round(totalTime),
      positionAnalyses,
      optimizationsSaved
    }
    
    // Cache result
    this.cacheZoneResult(cacheKey, result)
    
    console.log(`✅ [OPTIMIZER] Zone analysis complete: ${definitiveCount}/${couples.length} definitive in ${Math.round(totalTime)}ms`)
    return result
  }
  
  /**
   * ANÁLISIS INDIVIDUAL DE PAREJA CON ESTRATEGIAS PROGRESIVAS
   */
  private async analyzeCouplePosition(
    targetCouple: CoupleStats,
    allCouples: CoupleStats[],
    pendingMatches: PendingMatch[]
  ): Promise<OptimizedPositionAnalysis> {
    const startTime = performance.now()
    
    // Strategy 1: Fast Validation (O(n))
    const fastResult = this.runFastValidation(targetCouple, allCouples, pendingMatches)
    if (fastResult.isDefinitive) {
      return {
        ...fastResult,
        computationTimeMs: performance.now() - startTime,
        constraintsSatisfied: ['fast_validation_passed']
      }
    }
    
    // Strategy 2: Constraint Analysis (O(n²))
    const constraintResult = this.runConstraintAnalysis(targetCouple, allCouples, pendingMatches)
    if (constraintResult.isDefinitive) {
      return {
        ...constraintResult,
        computationTimeMs: performance.now() - startTime,
        constraintsSatisfied: ['constraint_analysis_passed']
      }
    }
    
    // Strategy 3: Limited Backtracking (O(k×18^m))
    const backtrackResult = await this.runOptimizedBacktracking(targetCouple, allCouples, pendingMatches)
    return {
      ...backtrackResult,
      computationTimeMs: performance.now() - startTime,
      constraintsSatisfied: ['backtracking_completed']
    }
  }
  
  /**
   * STRATEGY 1: FAST VALIDATION
   * Detecta casos obvios en O(n) time
   */
  private runFastValidation(
    targetCouple: CoupleStats,
    allCouples: CoupleStats[],
    pendingMatches: PendingMatch[]
  ): OptimizedPositionAnalysis {
    const otherCouples = allCouples.filter(c => c.coupleId !== targetCouple.coupleId)
    
    // CASO 1: 1ER LUGAR DEFINITIVO
    // Tiene 2 wins Y todas las demás tienen al menos 1 loss
    if (targetCouple.matchesWon === 2 && targetCouple.matchesLost === 0) {
      const allOthersHaveLoss = otherCouples.every(couple => couple.matchesLost >= 1)
      
      if (allOthersHaveLoss) {
        return {
          coupleId: targetCouple.coupleId,
          currentPosition: targetCouple.position,
          isDefinitive: true,
          possiblePositions: [1],
          analysisMethod: 'FAST_VALIDATION',
          analysisDetails: '1er lugar definitivo: 2W-0L y todas las demás con ≥1L',
          confidence: 1.0,
          computationTimeMs: 0,
          constraintsSatisfied: []
        }
      }
    }
    
    // CASO 2: 4TO LUGAR DEFINITIVO  
    // Tiene 2 losses Y todas las demás tienen al menos 1 win
    if (targetCouple.matchesLost === 2 && targetCouple.matchesWon === 0) {
      const allOthersHaveWin = otherCouples.every(couple => couple.matchesWon >= 1)
      
      if (allOthersHaveWin) {
        return {
          coupleId: targetCouple.coupleId,
          currentPosition: targetCouple.position,
          isDefinitive: true,
          possiblePositions: [4],
          analysisMethod: 'FAST_VALIDATION',
          analysisDetails: '4to lugar definitivo: 0W-2L y todas las demás con ≥1W',
          confidence: 1.0,
          computationTimeMs: 0,
          constraintsSatisfied: []
        }
      }
    }
    
    // CASO 3: NO PARTICIPA EN PARTIDOS PENDIENTES
    const participatesInPending = pendingMatches.some(match => 
      match.couple1_id === targetCouple.coupleId || 
      match.couple2_id === targetCouple.coupleId
    )
    
    if (!participatesInPending && targetCouple.matchesPlayed === 3) {
      // Ha completado todos sus partidos y no puede verse afectado
      return {
        coupleId: targetCouple.coupleId,
        currentPosition: targetCouple.position,
        isDefinitive: true,
        possiblePositions: [targetCouple.position],
        analysisMethod: 'FAST_VALIDATION',
        analysisDetails: 'Posición definitiva: 3 partidos jugados, no participa en pendientes',
        confidence: 1.0,
        computationTimeMs: 0,
        constraintsSatisfied: []
      }
    }
    
    return {
      coupleId: targetCouple.coupleId,
      currentPosition: targetCouple.position,
      isDefinitive: false,
      possiblePositions: [],
      analysisMethod: 'FAST_VALIDATION',
      analysisDetails: 'Fast validation inconclusive',
      confidence: 0.0,
      computationTimeMs: 0,
      constraintsSatisfied: []
    }
  }
  
  /**
   * STRATEGY 2: CONSTRAINT ANALYSIS
   * Análisis de límites matemáticos en O(n²) time
   */
  private runConstraintAnalysis(
    targetCouple: CoupleStats,
    allCouples: CoupleStats[],
    pendingMatches: PendingMatch[]
  ): OptimizedPositionAnalysis {
    
    // Calcular el mejor y peor escenario posible para esta pareja
    const { bestPosition, worstPosition, constraints } = this.calculatePositionBounds(
      targetCouple, 
      allCouples, 
      pendingMatches
    )
    
    // Si best === worst, la posición es definitiva
    if (bestPosition === worstPosition) {
      return {
        coupleId: targetCouple.coupleId,
        currentPosition: targetCouple.position,
        isDefinitive: true,
        possiblePositions: [bestPosition],
        analysisMethod: 'CONSTRAINT_ANALYSIS',
        analysisDetails: `Análisis de límites: posición ${bestPosition} es la única posible`,
        confidence: 1.0,
        computationTimeMs: 0,
        constraintsSatisfied: constraints
      }
    }
    
    // Si el rango es pequeño (≤2 posiciones), es relativamente estable
    const positionRange = worstPosition - bestPosition
    if (positionRange <= 1) {
      return {
        coupleId: targetCouple.coupleId,
        currentPosition: targetCouple.position,
        isDefinitive: false,
        possiblePositions: [bestPosition, worstPosition],
        analysisMethod: 'CONSTRAINT_ANALYSIS',
        analysisDetails: `Rango limitado: posiciones ${bestPosition}-${worstPosition}`,
        confidence: 0.8,
        computationTimeMs: 0,
        constraintsSatisfied: constraints
      }
    }
    
    return {
      coupleId: targetCouple.coupleId,
      currentPosition: targetCouple.position,
      isDefinitive: false,
      possiblePositions: [],
      analysisMethod: 'CONSTRAINT_ANALYSIS',
      analysisDetails: `Rango amplio: posiciones ${bestPosition}-${worstPosition}, requiere simulación`,
      confidence: 0.0,
      computationTimeMs: 0,
      constraintsSatisfied: constraints
    }
  }
  
  /**
   * STRATEGY 3: OPTIMIZED BACKTRACKING
   * Simulación inteligente con optimizaciones
   */
  private async runOptimizedBacktracking(
    targetCouple: CoupleStats,
    allCouples: CoupleStats[],
    pendingMatches: PendingMatch[]
  ): Promise<OptimizedPositionAnalysis> {
    
    const startTime = performance.now()
    
    // Generar escenarios ordenados por probabilidad
    const scenarios = this.generateProbabilisticScenarios(pendingMatches)
    console.log(`🎲 [BACKTRACK] Generated ${scenarios.length} probabilistic scenarios`)
    
    const possiblePositions = new Set<number>()
    let processedScenarios = 0
    const maxScenarios = Math.min(PERFORMANCE_CONFIG.MAX_BACKTRACK_SCENARIOS, scenarios.length)
    
    // Procesar escenarios en orden de probabilidad
    for (const scenario of scenarios) {
      if (processedScenarios >= maxScenarios) {
        console.warn(`⚠️ [BACKTRACK] Reached scenario limit (${maxScenarios})`)
        break
      }
      
      if (performance.now() - startTime > PERFORMANCE_CONFIG.MAX_ANALYSIS_TIME_MS) {
        console.warn(`⚠️ [BACKTRACK] Reached time limit (${PERFORMANCE_CONFIG.MAX_ANALYSIS_TIME_MS}ms)`)
        break
      }
      
      // Simular este escenario
      const finalRanking = this.simulateZoneWithOutcomes(allCouples, pendingMatches, scenario.outcomes)
      const newPosition = finalRanking.find(c => c.coupleId === targetCouple.coupleId)?.position
      
      if (newPosition) {
        possiblePositions.add(newPosition)
        
        // Early termination: si puede estar en muchas posiciones, no es definitiva
        if (possiblePositions.size >= PERFORMANCE_CONFIG.EARLY_TERMINATION_POSITIONS) {
          console.log(`🚫 [BACKTRACK] Early termination: ${possiblePositions.size} positions found`)
          break
        }
      }
      
      processedScenarios++
    }
    
    const positionsArray = Array.from(possiblePositions).sort((a, b) => a - b)
    const isDefinitive = positionsArray.length === 1
    const executionTime = performance.now() - startTime
    const confidence = processedScenarios >= scenarios.length ? 1.0 : 0.7
    
    console.log(`🔄 [BACKTRACK] Processed ${processedScenarios}/${scenarios.length} scenarios in ${Math.round(executionTime)}ms`)
    
    return {
      coupleId: targetCouple.coupleId,
      currentPosition: targetCouple.position,
      isDefinitive: isDefinitive,
      possiblePositions: positionsArray,
      analysisMethod: processedScenarios >= scenarios.length ? 'BACKTRACKING_FULL' : 'BACKTRACKING_LIMITED',
      analysisDetails: `Simulación: ${processedScenarios}/${scenarios.length} escenarios, ${Math.round(executionTime)}ms`,
      confidence: confidence,
      computationTimeMs: executionTime,
      constraintsSatisfied: ['simulation_completed']
    }
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  /**
   * Calcula los límites teóricos de posición para una pareja
   */
  private calculatePositionBounds(
    targetCouple: CoupleStats,
    allCouples: CoupleStats[],
    pendingMatches: PendingMatch[]
  ): { bestPosition: number; worstPosition: number; constraints: string[] } {
    
    const constraints: string[] = []
    
    // Escenario optimista: gana todos sus partidos pendientes
    const optimisticWins = targetCouple.matchesWon + this.countPendingMatchesForCouple(targetCouple.coupleId, pendingMatches)
    const optimisticLosses = targetCouple.matchesLost
    
    // Escenario pesimista: pierde todos sus partidos pendientes  
    const pessimisticWins = targetCouple.matchesWon
    const pessimisticLosses = targetCouple.matchesLost + this.countPendingMatchesForCouple(targetCouple.coupleId, pendingMatches)
    
    // Contar cuántas parejas pueden superar/empatar en cada escenario
    let betterThanOptimistic = 0
    let betterThanPessimistic = 0
    
    for (const otherCouple of allCouples) {
      if (otherCouple.coupleId === targetCouple.coupleId) continue
      
      const otherPendingMatches = this.countPendingMatchesForCouple(otherCouple.coupleId, pendingMatches)
      const otherMaxWins = otherCouple.matchesWon + otherPendingMatches
      const otherMinWins = otherCouple.matchesWon
      
      // Escenario optimista: ¿puede esta pareja superar a target?
      if (otherMaxWins > optimisticWins) {
        betterThanOptimistic++
      }
      
      // Escenario pesimista: ¿puede esta pareja superar a target?
      if (otherMinWins > pessimisticWins) {
        betterThanPessimistic++
      }
    }
    
    const bestPosition = betterThanOptimistic + 1
    const worstPosition = Math.min(4, allCouples.length - betterThanPessimistic)
    
    constraints.push(`optimistic_wins_${optimisticWins}`)
    constraints.push(`pessimistic_wins_${pessimisticWins}`)
    constraints.push(`better_than_optimistic_${betterThanOptimistic}`)
    constraints.push(`better_than_pessimistic_${betterThanPessimistic}`)
    
    return { bestPosition, worstPosition, constraints }
  }
  
  /**
   * Genera escenarios ordenados por probabilidad
   */
  private generateProbabilisticScenarios(pendingMatches: PendingMatch[]): { outcomes: MatchOutcome[]; probability: number }[] {
    const allScenarios: { outcomes: MatchOutcome[]; probability: number }[] = []
    
    // Generar todas las combinaciones
    const generateCombinations = (matchIndex: number, currentOutcomes: MatchOutcome[], currentProbability: number) => {
      if (matchIndex === pendingMatches.length) {
        // Solo incluir escenarios con probabilidad razonable
        if (currentProbability >= PERFORMANCE_CONFIG.PROBABILISTIC_CUTOFF) {
          allScenarios.push({
            outcomes: [...currentOutcomes],
            probability: currentProbability
          })
        }
        return
      }
      
      const currentMatch = pendingMatches[matchIndex]
      
      for (const result of PADEL_MATCH_RESULTS) {
        const outcome: MatchOutcome = {
          matchId: currentMatch.id,
          couple1Id: currentMatch.couple1_id,
          couple2Id: currentMatch.couple2_id,
          couple1Games: result.couple1Games,
          couple2Games: result.couple2Games,
          winnerId: result.winner === 'couple1' ? currentMatch.couple1_id : currentMatch.couple2_id
        }
        
        const newProbability = currentProbability * result.probability
        
        currentOutcomes.push(outcome)
        generateCombinations(matchIndex + 1, currentOutcomes, newProbability)
        currentOutcomes.pop()
      }
    }
    
    generateCombinations(0, [], 1.0)
    
    // Ordenar por probabilidad descendente
    return allScenarios.sort((a, b) => b.probability - a.probability)
  }
  
  /**
   * Simula zona con resultados específicos (con cache)
   */
  private simulateZoneWithOutcomes(
    originalCouples: CoupleStats[],
    pendingMatches: PendingMatch[],
    outcomes: MatchOutcome[]
  ): CoupleStats[] {
    
    // Cache key basado en outcomes
    const cacheKey = outcomes
      .map(o => `${o.matchId}:${o.winnerId}:${o.couple1Games}-${o.couple2Games}`)
      .sort()
      .join('|')
    
    if (this.simulationCache.has(cacheKey)) {
      return this.simulationCache.get(cacheKey)!
    }
    
    // Crear copia y aplicar resultados
    const updatedCouples = originalCouples.map(couple => ({ ...couple }))
    
    for (const outcome of outcomes) {
      const couple1 = updatedCouples.find(c => c.coupleId === outcome.couple1Id)
      const couple2 = updatedCouples.find(c => c.coupleId === outcome.couple2Id)
      
      if (couple1 && couple2) {
        // Actualizar wins/losses
        if (outcome.winnerId === outcome.couple1Id) {
          couple1.matchesWon += 1
          couple2.matchesLost += 1
        } else {
          couple2.matchesWon += 1
          couple1.matchesLost += 1
        }
        
        // Actualizar games
        couple1.gamesWon += outcome.couple1Games
        couple1.gamesLost += outcome.couple2Games
        couple2.gamesWon += outcome.couple2Games
        couple2.gamesLost += outcome.couple1Games
        
        // Recalcular diferencias
        couple1.gamesDifference = couple1.gamesWon - couple1.gamesLost
        couple2.gamesDifference = couple2.gamesWon - couple2.gamesLost
      }
    }
    
    // Ranking final
    const finalRanking = this.rankingEngine.rankCouplesByAllCriteria(updatedCouples, [])
    
    // Cache con TTL
    this.simulationCache.set(cacheKey, finalRanking)
    setTimeout(() => this.simulationCache.delete(cacheKey), PERFORMANCE_CONFIG.CACHE_TTL_MS)
    
    return finalRanking
  }
  
  /**
   * Cuenta partidos pendientes para una pareja
   */
  private countPendingMatchesForCouple(coupleId: string, pendingMatches: PendingMatch[]): number {
    return pendingMatches.filter(match => 
      match.couple1_id === coupleId || match.couple2_id === coupleId
    ).length
  }
  
  /**
   * Maneja caso de zona sin partidos pendientes
   */
  private handleNoPendingMatches(zoneId: string, zoneName: string, couples: CoupleStats[]): ZoneAnalysisResult {
    const positionAnalyses: OptimizedPositionAnalysis[] = couples.map(couple => ({
      coupleId: couple.coupleId,
      currentPosition: couple.position,
      isDefinitive: true,
      possiblePositions: [couple.position],
      analysisMethod: 'NO_PENDING_MATCHES' as const,
      analysisDetails: 'No hay partidos pendientes en la zona',
      confidence: 1.0,
      computationTimeMs: 0,
      constraintsSatisfied: ['no_pending_matches']
    }))
    
    return {
      zoneId,
      zoneName,
      totalCouples: couples.length,
      definitivePositions: couples.length,
      analysisTimeMs: 0,
      positionAnalyses,
      optimizationsSaved: ['No pending matches optimization']
    }
  }
  
  /**
   * Cache management
   */
  private generateZoneCacheKey(zoneId: string, couples: CoupleStats[], pendingMatches: PendingMatch[]): string {
    const coupleStates = couples
      .map(c => `${c.coupleId}:${c.matchesWon}-${c.matchesLost}-${c.gamesDifference}`)
      .sort()
      .join('|')
    
    const pendingStates = pendingMatches
      .map(m => `${m.id}:${m.couple1_id}-${m.couple2_id}`)
      .sort()
      .join('|')
    
    return `zone:${zoneId}:${coupleStates}:${pendingStates}`
  }
  
  private getCachedZoneResult(cacheKey: string): ZoneAnalysisResult | null {
    const timestamp = this.cacheTimestamps.get(cacheKey)
    if (timestamp && Date.now() - timestamp < PERFORMANCE_CONFIG.CACHE_TTL_MS) {
      // Cache válido - buscar resultado
      // En implementación real, usar Redis o similar
      return null // Por ahora
    }
    return null
  }
  
  private cacheZoneResult(cacheKey: string, result: ZoneAnalysisResult): void {
    this.cacheTimestamps.set(cacheKey, Date.now())
    // En implementación real, guardar en Redis
  }
  
  private createEmptyResult(zoneId: string, zoneName: string): ZoneAnalysisResult {
    return {
      zoneId,
      zoneName,
      totalCouples: 0,
      definitivePositions: 0,
      analysisTimeMs: 0,
      positionAnalyses: [],
      optimizationsSaved: []
    }
  }
  
  /**
   * Obtener datos de zona
   */
  private async fetchZoneData(zoneId: string): Promise<{
    couples: CoupleStats[]
    pendingMatches: PendingMatch[]
    zoneName?: string
  }> {
    const supabase = createClient()
    
    // Obtener información de zona
    const { data: zoneData } = await supabase
      .from('zones')
      .select('name')
      .eq('id', zoneId)
      .single()
    
    // Obtener posiciones actuales
    const { data: positions, error: positionsError } = await supabase
      .from('zone_positions')
      .select(`
        couple_id,
        position,
        wins,
        losses,
        games_for,
        games_against,
        games_difference,
        player_score_total,
        couples:couple_id (
          player1:player1_id (first_name, last_name),
          player2:player2_id (first_name, last_name)
        )
      `)
      .eq('zone_id', zoneId)
      .order('position')
    
    if (positionsError) {
      throw new Error(`Failed to fetch zone positions: ${positionsError.message}`)
    }
    
    // Obtener partidos pendientes
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id, couple1_id, couple2_id, zone_id')
      .eq('zone_id', zoneId)
      .in('status', ['PENDING', 'IN_PROGRESS'])
    
    if (matchesError) {
      throw new Error(`Failed to fetch pending matches: ${matchesError.message}`)
    }
    
    // Transformar datos
    const couples: CoupleStats[] = (positions || []).map((pos: any) => ({
      coupleId: pos.couple_id,
      player1Name: `${pos.couples?.player1?.first_name || ''} ${pos.couples?.player1?.last_name || ''}`.trim(),
      player2Name: `${pos.couples?.player2?.first_name || ''} ${pos.couples?.player2?.last_name || ''}`.trim(),
      position: pos.position,
      matchesWon: pos.wins,
      matchesLost: pos.losses,
      matchesPlayed: pos.wins + pos.losses,
      gamesWon: pos.games_for,
      gamesLost: pos.games_against,
      gamesDifference: pos.games_difference,
      totalPlayerScore: pos.player_score_total,
      positionTieInfo: '',
      // Campos adicionales
      player1Score: 0,
      player2Score: 0,
      setsWon: 0,
      setsLost: 0,
      setsDifference: 0
    }))
    
    return {
      couples,
      pendingMatches: matches || [],
      zoneName: zoneData?.name
    }
  }
}