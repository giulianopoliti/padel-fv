/**
 * ALGORITMO IDÉNTICO AL DE BRACKET GENERATION
 * Pero adaptado para una zona específica
 * 
 * Este algoritmo es EXACTAMENTE el mismo que se usa en update-definitive-positions/route.ts
 * pero sin optimizaciones de caché ni circuit breakers - solo el análisis puro
 */

import { createClient } from '@/utils/supabase/server'

export interface SingleZonePositionAnalysis {
  coupleId: string
  currentPosition: number
  isDefinitive: boolean
  possiblePositions: number[]
  analysisMethod: 'FAST_VALIDATION' | 'CONSTRAINT_ANALYSIS' | 'BACKTRACKING' | 'CONSERVATIVE_FALLBACK'
  analysisDetails: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  computationTime: number
}

export interface SingleZoneAnalysisResult {
  zoneId: string
  totalCouples: number
  definitivePositions: number
  analysis: SingleZonePositionAnalysis[]
  totalComputationTime: number
}

/**
 * ALGORITMO IDÉNTICO AL DE BRACKET GENERATION - SIN OPTIMIZACIONES
 */
export class SingleZoneDefinitiveAnalyzer {
  private async getSupabaseClient() {
    return await createClient()
  }

  /**
   * FUNCIÓN PRINCIPAL: IDÉNTICA AL BRACKET GENERATION
   * Sin caché, sin optimizaciones, algoritmo puro
   */
  async analyzeSingleZonePositions(zoneId: string): Promise<SingleZoneAnalysisResult> {
    console.log(`[SINGLE-ZONE-ANALYZER] 🔍 Analyzing zone: ${zoneId} (no cache, pure algorithm)`)
    
    const startTime = Date.now()
    
    // 1. Obtener datos de la zona y torneo
    const { couples, pending, tournamentStatus } = await this.fetchZoneData(zoneId)
    
    // 2. 🎯 FIX CORRECTED: Always analyze definitive positions regardless of tournament status
    // The tournament status only affects migration behavior, not position analysis
    console.log(`[SINGLE-ZONE-ANALYZER] 📊 Analyzing definitive positions for tournament in ${tournamentStatus} phase`)
    
    // 3. If no pending matches, all positions are definitive regardless of tournament status
    if (pending.length === 0) {
      console.log(`[SINGLE-ZONE-ANALYZER] ✅ No pending matches: all positions are definitive`)
      return this.createAllDefinitiveResult(zoneId, couples, startTime)
    }
    
    // 4. Apply 3-level algorithm for each couple when there are pending matches
    console.log(`[SINGLE-ZONE-ANALYZER] 📊 ${tournamentStatus}: Running full analysis for ${couples.length} couples, ${pending.length} pending matches`)
    const analysis = await this.performFullAnalysis(couples, pending)
    
    return this.createAnalysisResult(zoneId, couples, analysis, startTime)
  }

  /**
   * Obtener datos de zona y estado del torneo
   */
  private async fetchZoneData(zoneId: string) {
    const supabase = await this.getSupabaseClient()
    
    // Obtener posiciones de la zona
    const { data: positions, error: positionsError } = await supabase
      .from('zone_positions')
      .select('*')
      .eq('zone_id', zoneId)
      .order('position')
    
    if (!positions || positions.length === 0) {
      throw new Error(`No se encontraron posiciones para la zona ${zoneId}. Error: ${positionsError?.message || 'Unknown'}`)
    }
    
    // Obtener partidos pendientes
    const { data: pendingMatches, error: matchesError } = await supabase
      .from('matches')
      .select('id, couple1_id, couple2_id, status')
      .eq('zone_id', zoneId)
      .in('status', ['PENDING', 'IN_PROGRESS'])
    
    // Obtener estado del torneo
    const { data: zoneData } = await supabase
      .from('zones')
      .select('tournament_id')
      .eq('id', zoneId)
      .single()
    
    const { data: tournamentData } = await supabase
      .from('tournaments')
      .select('status')
      .eq('id', zoneData?.tournament_id)
      .single()
    
    console.log(`[SINGLE-ZONE-ANALYZER] Zone ${zoneId}: ${positions.length} positions, ${pendingMatches?.length || 0} pending matches, tournament status: ${tournamentData?.status}`)
    
    return {
      couples: positions,
      pending: pendingMatches || [],
      tournamentStatus: tournamentData?.status
    }
  }

  // createNonDefinitiveResult method removed - no longer needed
  // Analysis now always runs regardless of tournament status

  /**
   * Create result where ALL positions are definitive (no pending matches)
   */
  private createAllDefinitiveResult(zoneId: string, couples: any[], startTime: number): SingleZoneAnalysisResult {
    const analysis = couples.map(couple => ({
      coupleId: couple.couple_id,
      currentPosition: couple.position,
      isDefinitive: true,
      possiblePositions: [couple.position],
      analysisMethod: 'FAST_VALIDATION' as const,
      analysisDetails: 'No pending matches - all positions definitive',
      confidence: 'HIGH' as const,
      computationTime: 1
    }))
    
    console.log(`[SINGLE-ZONE-ANALYZER] ✅ No pending matches: ${couples.length}/${couples.length} definitivas`)
    
    return {
      zoneId,
      totalCouples: couples.length,
      definitivePositions: couples.length,
      analysis,
      totalComputationTime: Date.now() - startTime
    }
  }

  /**
   * Perform complete 3-level analysis when there are pending matches
   */
  private async performFullAnalysis(couples: any[], pending: any[]): Promise<SingleZonePositionAnalysis[]> {
    const analysis: SingleZonePositionAnalysis[] = []
    
    for (const couple of couples) {
      console.log(`[SINGLE-ZONE-ANALYZER] 🔍 Analyzing couple ${couple.couple_id} at position ${couple.position}`)
      
      // NIVEL 1: Fast Validation
      const fastValidation = this.checkFastValidation(couple, couples, pending)
      
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
        console.log(`[SINGLE-ZONE-ANALYZER] ✅ Fast validation: Position ${couple.position} is definitive`)
        continue
      }
      
      // NIVEL 2: Constraint Analysis Global (si hay ≤4 partidos)
      if (pending.length <= 4) {
        const constraintResult = this.performConstraintAnalysis(couple, couples, pending)
        
        if (constraintResult.isDefinitive || pending.length > 3) {
          analysis.push(constraintResult)
          console.log(`[SINGLE-ZONE-ANALYZER] ✅ Constraint analysis: Position ${couple.position} result: ${constraintResult.isDefinitive ? 'definitive' : 'not definitive'}`)
          continue
        }
      }
      
      // NIVEL 3: Backtracking Selectivo (IDÉNTICO AL DE BRACKET GENERATION)
      const backtrackingResult = this.performBacktracking(couple, couples, pending)
      analysis.push(backtrackingResult)
      console.log(`[SINGLE-ZONE-ANALYZER] ✅ Backtracking: Position ${couple.position} result: ${backtrackingResult.isDefinitive ? 'definitive' : 'not definitive'}`)
    }
    
    return analysis
  }

  /**
   * Crear resultado final del análisis
   */
  private createAnalysisResult(zoneId: string, couples: any[], analysis: SingleZonePositionAnalysis[], startTime: number): SingleZoneAnalysisResult {
    const definitiveCount = analysis.filter(a => a.isDefinitive).length
    
    const result: SingleZoneAnalysisResult = {
      zoneId,
      totalCouples: couples.length,
      definitivePositions: definitiveCount,
      analysis,
      totalComputationTime: Date.now() - startTime
    }
    
    console.log(`[SINGLE-ZONE-ANALYZER] ✅ Full analysis completed: ${definitiveCount}/${couples.length} definitivas en ${result.totalComputationTime}ms`)
    
    return result
  }

  /**
   * NIVEL 1: FAST VALIDATION (IDÉNTICO AL BRACKET GENERATION)
   */
  private checkFastValidation(
    targetCouple: any,
    allCouples: any[],
    pendingMatches: any[]
  ): { isDefinitive: boolean; reason: string } {
    
    const others = allCouples.filter(c => c.couple_id !== targetCouple.couple_id)

    // CASO 1: 1ER LUGAR DEFINITIVO
    if (targetCouple.wins === 2 && targetCouple.losses === 0) {
      const maxWinsPossibleForOthers = Math.max(...others.map(other => {
        const pendingForOther = pendingMatches.filter(m => 
          m.couple1_id === other.couple_id || m.couple2_id === other.couple_id
        ).length
        return other.wins + pendingForOther
      }))
      
      if (maxWinsPossibleForOthers < 2) {
        return {
          isDefinitive: true,
          reason: `1er lugar definitivo: tiene 2W-0L y nadie más puede llegar a 2 wins (max posible: ${maxWinsPossibleForOthers})`
        }
      }
    }

    // CASO 2: 4TO LUGAR DEFINITIVO
    if (targetCouple.wins === 0 && targetCouple.losses === 2) {
      const minWinsForOthers = Math.min(...others.map(other => other.wins))
      
      if (minWinsForOthers >= 1) {
        return {
          isDefinitive: true,
          reason: `4to lugar definitivo: tiene 0W-2L y todos los demás tienen ≥1W (min: ${minWinsForOthers})`
        }
      }
    }

    return {
      isDefinitive: false,
      reason: "Requiere análisis de constraint o backtracking"
    }
  }

  /**
   * NIVEL 2: CONSTRAINT ANALYSIS (IDÉNTICO AL BRACKET GENERATION)
   */
  private performConstraintAnalysis(
    targetCouple: any,
    allCouples: any[],
    pendingMatches: any[]
  ): SingleZonePositionAnalysis {
    
    const startTime = Date.now()
    
    // Generar escenarios extremos
    const extremeScenarios = this.generateExtremeScenarios(pendingMatches)
    const possiblePositions = new Set<number>()
    
    for (const scenario of extremeScenarios) {
      const simulatedCouples = this.simulateScenario(allCouples, scenario)
      const rankedCouples = this.rankCouples(simulatedCouples)
      
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
   * NIVEL 3: BACKTRACKING COMPLETO (IDÉNTICO AL BRACKET GENERATION)
   */
  private performBacktracking(
    targetCouple: any,
    allCouples: any[],
    pendingMatches: any[]
  ): SingleZonePositionAnalysis {
    
    const startTime = Date.now()
    const TIME_LIMIT = 5000 // 5 segundos máximo (igual que bracket generation)
    
    // Solo para casos con ≤3 partidos pendientes
    if (pendingMatches.length > 3) {
      return {
        coupleId: targetCouple.couple_id,
        currentPosition: targetCouple.position,
        isDefinitive: false,
        possiblePositions: [1, 2, 3, 4],
        analysisMethod: 'CONSERVATIVE_FALLBACK',
        analysisDetails: `Demasiados partidos pendientes (${pendingMatches.length}) para análisis exacto`,
        confidence: 'LOW',
        computationTime: Date.now() - startTime
      }
    }
    
    // Generar TODAS las combinaciones posibles (16^n) - IDÉNTICO AL BRACKET GENERATION
    const allCombinations = this.generateAllMatchCombinations(pendingMatches)
    const possiblePositions = new Set<number>()
    
    console.log(`[SINGLE-ZONE-ANALYZER] 🔄 Backtracking: Analyzing ${allCombinations.length} combinations for couple ${targetCouple.couple_id}`)
    
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
      const simulatedCouples = this.simulateScenario(allCouples, combination)
      const rankedCouples = this.rankCouples(simulatedCouples)
      
      const targetPosition = rankedCouples.findIndex(c => 
        c.couple_id === targetCouple.couple_id
      ) + 1
      
      possiblePositions.add(targetPosition)
    }
    
    const positions = Array.from(possiblePositions).sort((a, b) => a - b)
    const isDefinitive = positions.length === 1
    
    console.log(`[SINGLE-ZONE-ANALYZER] 🎯 Backtracking result: couple ${targetCouple.couple_id} can be in positions: ${positions.join(', ')}, definitive: ${isDefinitive}`)
    
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
   * FUNCIONES AUXILIARES (IDÉNTICAS AL BRACKET GENERATION)
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
    
    return scenarios
  }

  private generateAllMatchCombinations(pendingMatches: any[]) {
    // TODOS los resultados posibles (IDÉNTICO AL BRACKET GENERATION)
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

  private simulateScenario(allCouples: any[], scenario: any[]) {
    const couplesMap = new Map(allCouples.map(c => [c.couple_id, { ...c }]))
    
    for (const matchResult of scenario) {
      const couple1 = couplesMap.get(matchResult.couple1_id)
      const couple2 = couplesMap.get(matchResult.couple2_id)
      
      if (couple1 && couple2) {
        if (matchResult.winner === 'couple1') {
          couple1.wins += 1
          couple2.losses += 1
        } else {
          couple2.wins += 1
          couple1.losses += 1
        }
        
        couple1.games_for += matchResult.couple1Games
        couple1.games_against += matchResult.couple2Games
        couple2.games_for += matchResult.couple2Games
        couple2.games_against += matchResult.couple1Games
        
        couple1.games_difference = couple1.games_for - couple1.games_against
        couple2.games_difference = couple2.games_for - couple2.games_against
      }
    }
    
    return Array.from(couplesMap.values())
  }

  private rankCouples(couples: any[]) {
    return couples.sort((a, b) => {
      // 1. Wins (más wins mejor)
      if (a.wins !== b.wins) return b.wins - a.wins
      
      // 2. Games difference (mayor mejor)
      if (a.games_difference !== b.games_difference) {
        return b.games_difference - a.games_difference
      }
      
      // 3. Games won (más games a favor mejor)
      if (a.games_for !== b.games_for) return b.games_for - a.games_for
      
      // 4. Player scores (si disponible)
      if (a.player_score_total && b.player_score_total) {
        if (a.player_score_total !== b.player_score_total) {
          return b.player_score_total - a.player_score_total
        }
      }
      
      // 5. Random tiebreaker determinístico
      return a.couple_id.localeCompare(b.couple_id)
    }).map((couple, index) => ({
      ...couple,
      position: index + 1
    }))
  }

  /**
   * Actualizar is_definitive en base de datos (IDÉNTICO AL BRACKET GENERATION)
   */
  async updateDefinitiveFlags(zoneId: string, analysisResult: SingleZoneAnalysisResult): Promise<void> {
    const supabase = await this.getSupabaseClient()
    
    console.log(`[SINGLE-ZONE-ANALYZER] 💾 Updating is_definitive flags for zone ${zoneId}`)
    
    for (const analysis of analysisResult.analysis) {
      try {
        const { error } = await supabase
          .from('zone_positions')
          .update({ 
            is_definitive: analysis.isDefinitive,
            updated_at: new Date().toISOString()
          })
          .eq('zone_id', zoneId)
          .eq('couple_id', analysis.coupleId)

        if (error) {
          console.error(`[SINGLE-ZONE-ANALYZER] ❌ Error updating couple ${analysis.coupleId}:`, error)
        } else {
          console.log(`[SINGLE-ZONE-ANALYZER] ✅ Updated couple ${analysis.coupleId}: is_definitive = ${analysis.isDefinitive}`)
        }
      } catch (error) {
        console.error(`[SINGLE-ZONE-ANALYZER] ❌ Exception updating couple ${analysis.coupleId}:`, error)
      }
    }
    
    console.log(`[SINGLE-ZONE-ANALYZER] ✅ Updated is_definitive flags: ${analysisResult.definitivePositions}/${analysisResult.totalCouples} definitive`)
  }
}