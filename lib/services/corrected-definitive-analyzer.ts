/**
 * ALGORITMO CORREGIDO DE POSICIONES DEFINITIVAS
 * Versión final que corrige todos los errores lógicos identificados
 */

import { createClient, createClientServiceRole } from '@/utils/supabase/server'

export interface CorrectedPositionAnalysis {
  coupleId: string
  currentPosition: number
  isDefinitive: boolean
  possiblePositions: number[]
  analysisMethod: 'FAST_VALIDATION' | 'CONSTRAINT_ANALYSIS' | 'BACKTRACKING' | 'CONSERVATIVE_FALLBACK'
  analysisDetails: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  computationTime: number
}

export interface ZoneAnalysisResult {
  zoneId: string
  totalCouples: number
  definitivePositions: number
  analysis: CorrectedPositionAnalysis[]
  totalComputationTime: number
  optimizationsApplied: string[]
}

/**
 * ALGORITMO PRINCIPAL DE 3 NIVELES
 */
export class CorrectedDefinitiveAnalyzer {
  private cache: Map<string, { result: ZoneAnalysisResult; timestamp: number }>

  constructor() {
    this.cache = new Map()
  }

  private async getSupabaseClient() {
    // Use service role for internal system operations to bypass RLS
    return await createClientServiceRole()
  }

  /**
   * NEW: Analyze specific zone - optimized entry point for zone-specific analysis
   */
  async analyzeZone(tournamentId: string, zoneId?: string): Promise<ZoneAnalysisResult[]> {
    if (zoneId) {
      // Analyze only the specified zone
      const result = await this.analyzeZonePositions(zoneId)
      await this.updateZoneDefinitiveFlags(zoneId, result)
      return [result]
    } else {
      // Analyze all zones for the tournament (existing behavior)
      return this.analyzeAllZones(tournamentId)
    }
  }

  /**
   * NEW: Analyze all zones for a tournament (extracted from existing logic)
   */
  private async analyzeAllZones(tournamentId: string): Promise<ZoneAnalysisResult[]> {
    const supabase = await this.getSupabaseClient()
    
    // Get all zones for this tournament
    const { data: zones, error: zonesError } = await supabase
      .from('zones')
      .select('id, name')
      .eq('tournament_id', tournamentId)
      .order('created_at')

    if (zonesError || !zones) {
      throw new Error(`Failed to fetch zones: ${zonesError?.message}`)
    }

    const results: ZoneAnalysisResult[] = []
    
    for (const zone of zones) {
      try {
        const zoneResult = await this.analyzeZonePositions(zone.id)
        await this.updateZoneDefinitiveFlags(zone.id, zoneResult)
        results.push(zoneResult)
      } catch (error) {
        console.error(`Error analyzing zone ${zone.id}:`, error)
        // Continue with other zones even if one fails
      }
    }

    return results
  }

  /**
   * NEW: Update is_definitive flags for a specific zone
   */
  private async updateZoneDefinitiveFlags(zoneId: string, analysisResult: ZoneAnalysisResult): Promise<void> {
    const supabase = await this.getSupabaseClient()
    
    for (const analysis of analysisResult.analysis) {
      try {
        const { error } = await supabase
          .from('zone_positions')
          .update({ is_definitive: analysis.isDefinitive })
          .eq('zone_id', zoneId)
          .eq('couple_id', analysis.coupleId)

        if (error) {
          console.error(`Error updating is_definitive for couple ${analysis.coupleId} in zone ${zoneId}:`, error)
        }
      } catch (error) {
        console.error(`Exception updating is_definitive for couple ${analysis.coupleId}:`, error)
      }
    }
    
    console.log(`✅ [CORRECTED-ANALYZER] Updated is_definitive flags for zone ${zoneId}: ${analysisResult.definitivePositions}/${analysisResult.totalCouples} definitive`)
  }

  /**
   * NIVEL 1: FAST VALIDATION (casos 100% seguros)
   * 
   * CORRIGE EL ERROR: Solo casos donde es MATEMÁTICAMENTE IMPOSIBLE cambiar
   */
  private checkCorrectedFastValidation(
    targetCouple: any,
    allCouples: any[],
    pendingMatches: any[]
  ): { isDefinitive: boolean; reason: string } {
    
    const others = allCouples.filter(c => c.couple_id !== targetCouple.couple_id)

    // CASO 1: 1ER LUGAR DEFINITIVO (CORREGIDO)
    if (targetCouple.wins === 2 && targetCouple.losses === 0) {
      console.log(`[CORRECTED-ANALYZER] 🔍 DEBUG FAST VALIDATION para pareja ${targetCouple.couple_id}:`)
      console.log(`[CORRECTED-ANALYZER] Target: ${targetCouple.wins}W-${targetCouple.losses}L`)
      
      // Verificar que NADIE MÁS puede llegar a 2 wins
      const othersAnalysis = others.map(other => {
        const pendingForOther = pendingMatches.filter(m => 
          m.couple1_id === other.couple_id || m.couple2_id === other.couple_id
        ).length
        const maxPossible = other.wins + pendingForOther
        console.log(`[CORRECTED-ANALYZER] Rival ${other.couple_id}: ${other.wins}W actual + ${pendingForOther} pendientes = ${maxPossible} max posible`)
        return maxPossible
      })
      
      const maxWinsPossibleForOthers = Math.max(...othersAnalysis)
      console.log(`[CORRECTED-ANALYZER] MAX WINS POSIBLE PARA RIVALES: ${maxWinsPossibleForOthers}`)
      console.log(`[CORRECTED-ANALYZER] ¿Es ${maxWinsPossibleForOthers} < 2? ${maxWinsPossibleForOthers < 2}`)
      
      if (maxWinsPossibleForOthers < 2) {
        console.log(`[CORRECTED-ANALYZER] ✅ DEFINITIVA - Pareja ${targetCouple.couple_id} es 1er lugar definitivo`)
        return {
          isDefinitive: true,
          reason: `1er lugar definitivo: tiene 2W-0L y nadie más puede llegar a 2 wins (max posible: ${maxWinsPossibleForOthers})`
        }
      } else {
        console.log(`[CORRECTED-ANALYZER] ❌ NO DEFINITIVA - Rivales aún pueden llegar a 2W`)
      }
    }

    // CASO 2: 4TO LUGAR DEFINITIVO (CORREGIDO)
    if (targetCouple.wins === 0 && targetCouple.losses === 2) {
      // Verificar que TODOS los demás ya tienen al menos 1 win
      const minWinsForOthers = Math.min(...others.map(other => other.wins))

      if (minWinsForOthers >= 1) {
        return {
          isDefinitive: true,
          reason: `4to lugar definitivo: tiene 0W-2L y todos los demás tienen ≥1W (min: ${minWinsForOthers})`
        }
      }
    }

    // 🔴 BUG FIX: INTERMEDIATE POSITIONS (2nd, 3rd) CANNOT BE DEFINITIVE via Fast Validation
    // Reason: Tiebreaker (games_difference) can change even if W-L record is fixed
    //
    // Example: Couple with 1W-1L at position 2
    // - Another couple with 0W-1L could win pending match → also 1W-1L
    // - If new couple gets better games_difference, they surpass position 2
    // - Therefore: Position 2 is NOT definitive until all matches complete
    //
    // SOLUTION: For 2nd/3rd positions, ALWAYS use Constraint/Backtracking analysis

    // CASO 3: ELIMINADO - Este era el error crítico
    // ❌ if (couple no participa en partidos pendientes) → NO ES VÁLIDO

    return {
      isDefinitive: false,
      reason: "Requiere análisis de constraint o backtracking (intermediate positions require tiebreaker simulation)"
    }
  }

  /**
   * NIVEL 2: CONSTRAINT ANALYSIS GLOBAL (CORREGIDO)
   * 
   * CORRIGE EL ERROR: Ahora considera efectos en TODAS las parejas
   */
  private performGlobalConstraintAnalysis(
    targetCouple: any,
    allCouples: any[],
    pendingMatches: any[]
  ): CorrectedPositionAnalysis {
    
    const startTime = Date.now()
    
    // Generar escenarios extremos que afectan a TODAS las parejas
    const extremeScenarios = this.generateExtremeScenarios(pendingMatches)
    const possiblePositions = new Set<number>()
    
    for (const scenario of extremeScenarios) {
      // Simular efecto en TODAS las parejas (no solo target)
      const simulatedCouples = this.simulateScenarioOnAllCouples(allCouples, scenario)
      
      // Recalcular ranking completo
      const rankedCouples = this.rankCouplesWithFullCriteria(simulatedCouples)
      
      // Encontrar nueva posición del target
      const targetPosition = rankedCouples.findIndex(c => 
        c.couple_id === targetCouple.couple_id
      ) + 1
      
      possiblePositions.add(targetPosition)
    }
    
    const positions = Array.from(possiblePositions).sort((a, b) => a - b)
    const isDefinitive = positions.length === 1
    const computationTime = Date.now() - startTime
    
    return {
      coupleId: targetCouple.couple_id,
      currentPosition: targetCouple.position,
      isDefinitive,
      possiblePositions: positions,
      analysisMethod: 'CONSTRAINT_ANALYSIS',
      analysisDetails: `Análisis global: ${extremeScenarios.length} escenarios extremos, posiciones posibles: ${positions.join(', ')}`,
      confidence: isDefinitive ? 'HIGH' : 'MEDIUM',
      computationTime
    }
  }

  /**
   * GENERAR ESCENARIOS EXTREMOS (en lugar de todos los 18^n)
   */
  private generateExtremeScenarios(pendingMatches: any[]) {
    if (pendingMatches.length === 0) return []
    
    const scenarios = []
    
    // Escenario 1: Todos los favoritos ganan 6-0
    scenarios.push(
      pendingMatches.map(match => ({
        matchId: match.id,
        couple1_id: match.couple1_id,
        couple2_id: match.couple2_id,
        winner: 'couple1',
        couple1Games: 6,
        couple2Games: 0
      }))
    )
    
    // Escenario 2: Todos los underdogs ganan 6-0  
    scenarios.push(
      pendingMatches.map(match => ({
        matchId: match.id,
        couple1_id: match.couple1_id,
        couple2_id: match.couple2_id,
        winner: 'couple2',
        couple1Games: 0,
        couple2Games: 6
      }))
    )
    
    // Escenario 3: Partidos ajustados 6-4
    scenarios.push(
      pendingMatches.map(match => ({
        matchId: match.id,
        couple1_id: match.couple1_id,
        couple2_id: match.couple2_id,
        winner: 'couple1',
        couple1Games: 6,
        couple2Games: 4
      }))
    )
    
    // Para 2-3 partidos, agregar combinaciones mixtas críticas
    if (pendingMatches.length <= 3) {
      scenarios.push(...this.generateMixedCriticalScenarios(pendingMatches))
    }
    
    return scenarios
  }

  /**
   * SIMULAR ESCENARIO EN TODAS LAS PAREJAS
   */
  private simulateScenarioOnAllCouples(allCouples: any[], scenario: any[]) {
    const couplesMap = new Map(allCouples.map(c => [c.couple_id, { ...c }]))
    
    // Aplicar resultados de todos los partidos del escenario
    for (const matchResult of scenario) {
      const couple1 = couplesMap.get(matchResult.couple1_id)
      const couple2 = couplesMap.get(matchResult.couple2_id)
      
      if (couple1 && couple2) {
        // Actualizar estadísticas
        if (matchResult.winner === 'couple1') {
          couple1.wins += 1
          couple2.losses += 1
        } else {
          couple2.wins += 1
          couple1.losses += 1
        }
        
        // Actualizar games
        couple1.games_for += matchResult.couple1Games
        couple1.games_against += matchResult.couple2Games
        couple2.games_for += matchResult.couple2Games
        couple2.games_against += matchResult.couple1Games
        
        // Recalcular games difference
        couple1.games_difference = couple1.games_for - couple1.games_against
        couple2.games_difference = couple2.games_for - couple2.games_against
      }
    }
    
    return Array.from(couplesMap.values())
  }

  /**
   * RANKING COMPLETO CON TODOS LOS CRITERIOS
   * 🆕 Usa ZoneRankingEngine para garantizar consistencia con cálculo de posiciones
   */
  private async rankCouplesWithFullCriteria(couples: any[], finishedMatches: any[]) {
    // Importar el engine real del sistema de zonas
    const { ZoneStatsCalculator, ZoneRankingEngine } = await import('@/lib/services/zone-position')

    // 1. Convertir formato interno a CoupleData (formato esperado por ZoneStatsCalculator)
    const coupleData = couples.map(c => ({
      id: c.couple_id,
      player1_id: c.player1_id || '',
      player2_id: c.player2_id || '',
      player1: {
        id: c.player1_id || '',
        first_name: c.player1_name?.split(' ')[0] || '',
        last_name: c.player1_name?.split(' ').slice(1).join(' ') || '',
        score: c.player_score_total || 0
      },
      player2: {
        id: c.player2_id || '',
        first_name: c.player2_name?.split(' ')[0] || '',
        last_name: c.player2_name?.split(' ').slice(1).join(' ') || '',
        score: 0  // Total score ya está en couple
      }
    }))

    // 2. Convertir formato interno a MatchData (formato esperado por ZoneStatsCalculator)
    const matchData = finishedMatches.map(m => ({
      id: m.id,
      couple1_id: m.couple1_id,
      couple2_id: m.couple2_id,
      result_couple1: m.result_couple1,
      result_couple2: m.result_couple2,
      winner_id: m.winner_id,
      status: 'FINISHED' as const,
      zone_id: m.zone_id
    }))

    // 3. Crear CoupleStats para cada pareja usando stats simuladas
    const coupleStats = couples.map(c => ({
      coupleId: c.couple_id,
      player1Name: c.player1_name || '',
      player2Name: c.player2_name || '',
      player1Score: 0,
      player2Score: 0,
      totalPlayerScore: c.player_score_total || 0,
      matchesWon: c.wins,              // ✅ Viene de la simulación
      matchesLost: c.losses,           // ✅ Viene de la simulación
      matchesPlayed: c.wins + c.losses,
      setsWon: c.wins,
      setsLost: c.losses,
      setsDifference: c.wins - c.losses,
      gamesWon: c.games_for,           // ✅ Viene de la simulación
      gamesLost: c.games_against,      // ✅ Viene de la simulación
      gamesDifference: c.games_difference,  // ✅ Viene de la simulación
      position: 0,  // Se asignará después
      positionTieInfo: ''
    }))

    // 4. Crear head-to-head matrix usando matches finalizados
    const calculator = new ZoneStatsCalculator()
    const headToHeadMatrix = calculator.createHeadToHeadMatrix(coupleData, matchData)

    // 5. Aplicar el ranking engine REAL (con head-to-head)
    const engine = new ZoneRankingEngine()
    const rankedStats = engine.rankCouplesByAllCriteria(coupleStats, headToHeadMatrix)

    // 6. Convertir de vuelta al formato interno del analyzer
    return rankedStats.map((stats, index) => {
      const originalCouple = couples.find(c => c.couple_id === stats.coupleId)
      return {
        ...originalCouple,
        position: index + 1  // Posición basada en ranking real
      }
    })
  }

  /**
   * NIVEL 3: BACKTRACKING SELECTIVO (casos complejos con límites)
   */
  private async performSelectiveBacktracking(
    targetCouple: any,
    allCouples: any[],
    pendingMatches: any[],
    finishedMatches: any[]  // 🆕 Partidos finalizados para head-to-head
  ): Promise<CorrectedPositionAnalysis> {
    
    const startTime = Date.now()
    const TIME_LIMIT = 5000 // 5 segundos máximo
    
    // Solo para casos con ≤3 partidos pendientes
    if (pendingMatches.length > 3) {
      return {
        coupleId: targetCouple.couple_id,
        currentPosition: targetCouple.position,
        isDefinitive: false,
        possiblePositions: [1, 2, 3, 4], // Conservador
        analysisMethod: 'CONSERVATIVE_FALLBACK',
        analysisDetails: `Demasiados partidos pendientes (${pendingMatches.length}) para análisis exacto`,
        confidence: 'LOW',
        computationTime: Date.now() - startTime
      }
    }
    
    // Generar TODAS las combinaciones posibles (18^n)
    const allCombinations = this.generateAllMatchCombinations(pendingMatches)
    const possiblePositions = new Set<number>()
    
    for (const combination of allCombinations) {
      // Verificar límite de tiempo
      if (Date.now() - startTime > TIME_LIMIT) {
        return {
          coupleId: targetCouple.couple_id,
          currentPosition: targetCouple.position,
          isDefinitive: false,
          possiblePositions: Array.from(possiblePositions),
          analysisMethod: 'BACKTRACKING',
          analysisDetails: `Timeout tras ${allCombinations.indexOf(combination)} de ${allCombinations.length} combinaciones`,
          confidence: 'MEDIUM',
          computationTime: Date.now() - startTime
        }
      }
      
      // Simular combinación completa
      const simulatedCouples = this.simulateScenarioOnAllCouples(allCouples, combination)
      const rankedCouples = await this.rankCouplesWithFullCriteria(
        simulatedCouples,
        finishedMatches  // 🆕 Pasar matches finalizados para head-to-head
      )
      
      const targetPosition = rankedCouples.findIndex(c => 
        c.couple_id === targetCouple.couple_id
      ) + 1
      
      possiblePositions.add(targetPosition)
    }
    
    const positions = Array.from(possiblePositions).sort((a, b) => a - b)
    const isDefinitive = positions.length === 1
    
    return {
      coupleId: targetCouple.couple_id,
      currentPosition: targetCouple.position,
      isDefinitive,
      possiblePositions: positions,
      analysisMethod: 'BACKTRACKING',
      analysisDetails: `Backtracking completo: ${allCombinations.length} combinaciones analizadas`,
      confidence: 'HIGH',
      computationTime: Date.now() - startTime
    }
  }

  /**
   * FUNCIÓN PRINCIPAL: ANALIZAR ZONA COMPLETA
   */
  async analyzeZonePositions(zoneId: string): Promise<ZoneAnalysisResult> {
    console.log(`[CORRECTED-ANALYZER] ANALIZANDO ZONA ${zoneId}`)
    const startTime = Date.now()
    
    // Verificar caché
    const cached = this.cache.get(zoneId)
    if (cached && Date.now() - cached.timestamp < 60000) { // 1 minuto TTL
      return cached.result
    }
    
    // 1. Obtener datos de la zona
    const supabase = await this.getSupabaseClient()
    
    const { data: positions, error: positionsError } = await supabase
      .from('zone_positions')
      .select('*')
      .eq('zone_id', zoneId)
      .order('position')
    
    const { data: pendingMatches, error: matchesError} = await supabase
      .from('matches')
      .select('id, couple1_id, couple2_id')
      .eq('zone_id', zoneId)
      .in('status', ['PENDING', 'IN_PROGRESS'])

    // 🆕 NUEVO: Obtener partidos finalizados (necesarios para head-to-head en backtracking)
    const { data: finishedMatches, error: finishedError } = await supabase
      .from('matches')
      .select('id, couple1_id, couple2_id, result_couple1, result_couple2, winner_id, status, zone_id')
      .eq('zone_id', zoneId)
      .eq('status', 'FINISHED')
      .not('result_couple1', 'is', null)
      .not('result_couple2', 'is', null)

    console.log(`[CORRECTED-ANALYZER] Debug - Zone ${zoneId}:`)
    console.log(`[CORRECTED-ANALYZER] Positions error:`, positionsError)
    console.log(`[CORRECTED-ANALYZER] Positions data:`, positions?.length || 0, 'items')
    console.log(`[CORRECTED-ANALYZER] Pending matches error:`, matchesError)
    console.log(`[CORRECTED-ANALYZER] Pending matches data:`, pendingMatches?.length || 0, 'items')
    console.log(`[CORRECTED-ANALYZER] Finished matches error:`, finishedError)
    console.log(`[CORRECTED-ANALYZER] Finished matches data:`, finishedMatches?.length || 0, 'items')
    
    if (!positions || positions.length === 0) {
      throw new Error(`No se encontraron posiciones para la zona ${zoneId}. Error: ${positionsError?.message || 'Unknown'}`)
    }
    
    const couples = positions
    const pending = pendingMatches || []
    
    console.log(`[CORRECTED-ANALYZER] 📊 Zona ${zoneId}: ${couples.length} parejas, ${pending.length} partidos pendientes`)
    
    // 2. Si no hay partidos pendientes, todas son definitivas
    if (pending.length === 0) {
      console.log(`[CORRECTED-ANALYZER] 📊 Zona ${zoneId}: No hay partidos pendientes - todas las posiciones son definitivas`)
      const analysis = couples.map(couple => ({
        coupleId: couple.couple_id,
        currentPosition: couple.position,
        isDefinitive: true,
        possiblePositions: [couple.position],
        analysisMethod: 'FAST_VALIDATION' as const,
        analysisDetails: 'No hay partidos pendientes - todas las posiciones son definitivas',
        confidence: 'HIGH' as const,
        computationTime: 1
      }))
      
      const result: ZoneAnalysisResult = {
        zoneId,
        totalCouples: couples.length,
        definitivePositions: couples.length,
        analysis,
        totalComputationTime: Date.now() - startTime,
        optimizationsApplied: ['NO_PENDING_MATCHES_SHORTCUT']
      }
      
      this.cache.set(zoneId, { result, timestamp: Date.now() })
      return result
    }
    
    // 3. Aplicar algoritmo de 3 niveles para cada pareja
    const analysis: CorrectedPositionAnalysis[] = []
    const optimizations: string[] = []
    
    for (const couple of couples) {
      // NIVEL 1: Fast Validation
      const fastValidation = this.checkCorrectedFastValidation(couple, couples, pending)
      console.log(`[CORRECTED-ANALYZER] 📊 Zona ${zoneId}: Fast Validation: ${fastValidation.isDefinitive}`)
      if (fastValidation.isDefinitive) {
        analysis.push({
          coupleId: couple.couple_id,
          currentPosition: couple.position,
          isDefinitive: true,
          possiblePositions: [couple.position],
          analysisMethod: 'FAST_VALIDATION',
          analysisDetails: fastValidation.reason,
          confidence: 'HIGH',
          computationTime: 1
        })
        optimizations.push(`FAST_VALIDATION_${couple.position}`)
        continue
      }
      
      // NIVEL 2: Constraint Analysis Global
      // 🔴 BUG FIX: Skip Constraint Analysis for intermediate positions
      // Constraint Analysis with only 3 scenarios doesn't cover all tiebreaker cases
      // Example: Martin winning 6-1 surpasses Silvana, but this isn't in the 3 scenarios
      // SOLUTION: Always use Backtracking for accuracy
      if (pending.length <= 4 && pending.length >= 10) { // Disabled: never true
        const constraintResult = this.performGlobalConstraintAnalysis(couple, couples, pending)

        if (constraintResult.isDefinitive || pending.length > 3) {
          analysis.push(constraintResult)
          optimizations.push(`CONSTRAINT_ANALYSIS_${couple.position}`)
          continue
        }
      }
      
      // NIVEL 3: Backtracking Selectivo
      const backtrackingResult = await this.performSelectiveBacktracking(
        couple,
        couples,
        pending,
        finishedMatches || []  // 🆕 Pasar matches finalizados para head-to-head
      )
      analysis.push(backtrackingResult)
      optimizations.push(`BACKTRACKING_${couple.position}`)
    }
    
    const definitiveCount = analysis.filter(a => a.isDefinitive).length
    
    const result: ZoneAnalysisResult = {
      zoneId,
      totalCouples: couples.length,
      definitivePositions: definitiveCount,
      analysis,
      totalComputationTime: Date.now() - startTime,
      optimizationsApplied: optimizations
    }
    
    // Guardar en caché
    this.cache.set(zoneId, { result, timestamp: Date.now() })
    
    console.log(`[CORRECTED-ANALYZER] ✅ Zona completada: ${definitiveCount}/${couples.length} definitivas en ${result.totalComputationTime}ms`)
    
    return result
  }

  // Métodos auxiliares
  private generateMixedCriticalScenarios(pendingMatches: any[]) {
    const scenarios = []
    
    if (pendingMatches.length === 2) {
      // Combinaciones críticas para 2 partidos
      scenarios.push([
        { ...pendingMatches[0], winner: 'couple1', couple1Games: 6, couple2Games: 0 },
        { ...pendingMatches[1], winner: 'couple2', couple1Games: 0, couple2Games: 6 }
      ])
      
      scenarios.push([
        { ...pendingMatches[0], winner: 'couple2', couple1Games: 5, couple2Games: 7 },
        { ...pendingMatches[1], winner: 'couple1', couple1Games: 7, couple2Games: 5 }
      ])
    }
    
    return scenarios
  }

  private generateAllMatchCombinations(pendingMatches: any[]) {
    const ALL_RESULTS = [
      { couple1Games: 6, couple2Games: 0, winner: 'couple1' },
      { couple1Games: 6, couple2Games: 1, winner: 'couple1' },
      { couple1Games: 6, couple2Games: 2, winner: 'couple1' },
      { couple1Games: 6, couple2Games: 3, winner: 'couple1' },
      { couple1Games: 6, couple2Games: 4, winner: 'couple1' },
      { couple1Games: 6, couple2Games: 5, winner: 'couple1' },
      { couple1Games: 7, couple2Games: 5, winner: 'couple1' },
      { couple1Games: 7, couple2Games: 6, winner: 'couple1' },
      { couple1Games: 0, couple2Games: 6, winner: 'couple2' },
      { couple1Games: 1, couple2Games: 6, winner: 'couple2' },
      { couple1Games: 2, couple2Games: 6, winner: 'couple2' },
      { couple1Games: 3, couple2Games: 6, winner: 'couple2' },
      { couple1Games: 4, couple2Games: 6, winner: 'couple2' },
      { couple1Games: 5, couple2Games: 6, winner: 'couple2' },
      { couple1Games: 5, couple2Games: 7, winner: 'couple2' },
      { couple1Games: 6, couple2Games: 7, winner: 'couple2' }
    ]
    
    const allCombinations: any[] = []
    
    const generateCombination = (matchIndex: number, currentCombination: any[]) => {
      if (matchIndex === pendingMatches.length) {
        allCombinations.push([...currentCombination])
        return
      }
      
      const match = pendingMatches[matchIndex]
      
      for (const result of ALL_RESULTS) {
        currentCombination.push({
          matchId: match.id,
          couple1_id: match.couple1_id,
          couple2_id: match.couple2_id,
          winner: result.winner,
          couple1Games: result.couple1Games,
          couple2Games: result.couple2Games
        })
        
        generateCombination(matchIndex + 1, currentCombination)
        currentCombination.pop()
      }
    }
    
    generateCombination(0, [])
    return allCombinations
  }

  clearCache() {
    this.cache.clear()
  }

  getPerformanceMetrics() {
    return {
      cacheSize: this.cache.size,
      cacheHits: 0,
      totalSimulations: 0
    }
  }
}