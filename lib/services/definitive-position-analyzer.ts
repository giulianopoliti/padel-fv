/**
 * Definitive Position Analyzer
 * Analiza si las posiciones en zona son definitivas o pueden cambiar
 */

import { createClient } from '@/utils/supabase/client'
import { ZoneRankingEngine } from './zone-position/zone-ranking-engine'
import type { CoupleStats, MatchData } from './zone-position/types'

export interface PositionAnalysisResult {
  coupleId: string
  currentPosition: number
  isDefinitive: boolean
  possiblePositions: number[]
  analysisMethod: 'FAST_VALIDATION' | 'BACKTRACKING' | 'NO_PENDING_MATCHES'
  analysisDetails: string
  confidence: number // 0-1, qué tan seguro estamos del resultado
}

export interface MatchOutcome {
  matchId: string
  couple1Id: string
  couple2Id: string
  couple1Games: number
  couple2Games: number
  winnerId: string
}

export interface PendingMatch {
  id: string
  couple1_id: string
  couple2_id: string
  zone_id: string
}

// Todos los resultados posibles en un partido de padel
const ALL_POSSIBLE_MATCH_RESULTS = [
  // Couple1 gana
  { couple1Games: 6, couple2Games: 0, winner: 'couple1' },
  { couple1Games: 6, couple2Games: 1, winner: 'couple1' },
  { couple1Games: 6, couple2Games: 2, winner: 'couple1' },
  { couple1Games: 6, couple2Games: 3, winner: 'couple1' },
  { couple1Games: 6, couple2Games: 4, winner: 'couple1' },
  { couple1Games: 6, couple2Games: 5, winner: 'couple1' },
  { couple1Games: 7, couple2Games: 5, winner: 'couple1' },
  { couple1Games: 7, couple2Games: 6, winner: 'couple1' },
  
  // Couple2 gana  
  { couple1Games: 0, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 1, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 2, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 3, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 4, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 5, couple2Games: 6, winner: 'couple2' },
  { couple1Games: 5, couple2Games: 7, winner: 'couple2' },
  { couple1Games: 6, couple2Games: 7, winner: 'couple2' }
] as const

export class DefinitivePositionAnalyzer {
  private rankingEngine: ZoneRankingEngine
  private simulationCache = new Map<string, CoupleStats[]>()
  
  constructor() {
    this.rankingEngine = new ZoneRankingEngine()
  }
  
  /**
   * Analiza todas las posiciones de una zona para determinar cuáles son definitivas
   */
  async analyzeZonePositions(zoneId: string): Promise<PositionAnalysisResult[]> {
    console.log(`🔍 [ANALYZER] Starting analysis for zone: ${zoneId}`)
    
    // 1. Obtener datos actuales de la zona
    const { couples, pendingMatches } = await this.fetchZoneData(zoneId)
    
    if (couples.length === 0) {
      console.log(`⚠️ [ANALYZER] No couples found in zone ${zoneId}`)
      return []
    }
    
    console.log(`📊 [ANALYZER] Zone data:`)
    console.log(`  - Couples: ${couples.length}`)
    console.log(`  - Pending matches: ${pendingMatches.length}`)
    
    // 2. Si no hay partidos pendientes, todas las posiciones son definitivas
    if (pendingMatches.length === 0) {
      console.log(`✅ [ANALYZER] No pending matches - all positions definitive`)
      return couples.map(couple => ({
        coupleId: couple.coupleId,
        currentPosition: couple.position,
        isDefinitive: true,
        possiblePositions: [couple.position],
        analysisMethod: 'NO_PENDING_MATCHES' as const,
        analysisDetails: 'No hay partidos pendientes en la zona',
        confidence: 1.0
      }))
    }
    
    // 3. Analizar cada pareja
    const results: PositionAnalysisResult[] = []
    
    for (const couple of couples) {
      console.log(`🔍 [ANALYZER] Analyzing couple ${couple.player1Name} / ${couple.player2Name} (pos ${couple.position})`)
      
      // Primero intentar validaciones rápidas
      const fastValidation = this.checkFastValidationCases(couple, couples, pendingMatches)
      
      if (fastValidation.isDefinitive) {
        console.log(`⚡ [ANALYZER] Fast validation: ${fastValidation.reason}`)
        results.push({
          coupleId: couple.coupleId,
          currentPosition: couple.position,
          isDefinitive: true,
          possiblePositions: [couple.position],
          analysisMethod: 'FAST_VALIDATION',
          analysisDetails: fastValidation.reason,
          confidence: 1.0
        })
      } else {
        // Usar backtracking completo
        console.log(`🔄 [ANALYZER] Running backtracking analysis...`)
        const backtrackingResult = await this.analyzePositionByBacktracking(couple, couples, pendingMatches)
        results.push(backtrackingResult)
      }
    }
    
    console.log(`✅ [ANALYZER] Analysis complete for zone ${zoneId}`)
    return results
  }
  
  /**
   * Validaciones rápidas para casos obvios
   */
  private checkFastValidationCases(
    targetCouple: CoupleStats,
    allCouples: CoupleStats[],
    pendingMatches: PendingMatch[]
  ): { isDefinitive: boolean; reason: string } {
    
    const otherCouples = allCouples.filter(c => c.coupleId !== targetCouple.coupleId)
    
    // CASO 1: 1ER LUGAR DEFINITIVO
    // Condición: Pareja tiene 2 wins Y todas las demás tienen al menos 1 loss
    if (targetCouple.matchesWon === 2 && targetCouple.matchesLost === 0) {
      const allOthersHaveLoss = otherCouples.every(couple => couple.matchesLost >= 1)
      
      if (allOthersHaveLoss) {
        return {
          isDefinitive: true,
          reason: "1er lugar definitivo: tiene 2 wins y todas las demás parejas tienen al menos 1 loss"
        }
      }
    }
    
    // CASO 2: 4TO LUGAR DEFINITIVO  
    // Condición: Pareja tiene 2 losses Y todas las demás tienen al menos 1 win
    if (targetCouple.matchesLost === 2 && targetCouple.matchesWon === 0) {
      const allOthersHaveWin = otherCouples.every(couple => couple.matchesWon >= 1)
      
      if (allOthersHaveWin) {
        return {
          isDefinitive: true,
          reason: "4to lugar definitivo: tiene 2 losses y todas las demás parejas tienen al menos 1 win"
        }
      }
    }
    
    return {
      isDefinitive: false,
      reason: "Requiere análisis completo por backtracking"
    }
  }
  
  /**
   * Análisis completo usando backtracking
   */
  private async analyzePositionByBacktracking(
    targetCouple: CoupleStats,
    allCouples: CoupleStats[],
    pendingMatches: PendingMatch[]
  ): Promise<PositionAnalysisResult> {
    
    const startTime = Date.now()
    
    // Generar todos los resultados posibles
    const allOutcomes = this.generateAllPossibleOutcomes(pendingMatches)
    console.log(`🎲 [BACKTRACK] Generated ${allOutcomes.length} possible outcomes`)
    
    const possiblePositions = new Set<number>()
    let processedScenarios = 0
    const maxScenarios = Math.min(1000, allOutcomes.length) // Límite de performance
    
    for (const outcomeSet of allOutcomes) {
      if (processedScenarios >= maxScenarios) {
        console.warn(`⚠️ [BACKTRACK] Reached scenario limit (${maxScenarios}) for performance`)
        break
      }
      
      // Simular este escenario específico
      const finalRanking = this.simulateZoneWithOutcomes(allCouples, pendingMatches, outcomeSet)
      const newPosition = finalRanking.find(c => c.coupleId === targetCouple.coupleId)?.position
      
      if (newPosition) {
        possiblePositions.add(newPosition)
        
        // Poda temprana: si ya puede estar en 3+ posiciones, no es definitiva
        if (possiblePositions.size >= 3) {
          break
        }
      }
      
      processedScenarios++
    }
    
    const positionsArray = Array.from(possiblePositions).sort((a, b) => a - b)
    const isDefinitive = positionsArray.length === 1
    const executionTime = Date.now() - startTime
    
    console.log(`🔄 [BACKTRACK] Processed ${processedScenarios}/${allOutcomes.length} scenarios in ${executionTime}ms`)
    console.log(`📊 [BACKTRACK] Possible positions: ${positionsArray.join(', ')}`)
    
    return {
      coupleId: targetCouple.coupleId,
      currentPosition: targetCouple.position,
      isDefinitive: isDefinitive,
      possiblePositions: positionsArray,
      analysisMethod: 'BACKTRACKING',
      analysisDetails: `Procesados ${processedScenarios}/${allOutcomes.length} escenarios en ${executionTime}ms. ${isDefinitive ? 'Posición definitiva' : `Posiciones posibles: ${positionsArray.join(', ')}`}`,
      confidence: processedScenarios >= allOutcomes.length ? 1.0 : 0.8
    }
  }
  
  /**
   * Genera todas las combinaciones posibles de resultados de partidos pendientes
   */
  private generateAllPossibleOutcomes(pendingMatches: PendingMatch[]): MatchOutcome[][] {
    const allOutcomes: MatchOutcome[][] = []
    
    function backtrack(matchIndex: number, currentOutcomes: MatchOutcome[]) {
      // Caso base: hemos procesado todos los partidos
      if (matchIndex === pendingMatches.length) {
        allOutcomes.push([...currentOutcomes])
        return
      }
      
      const currentMatch = pendingMatches[matchIndex]
      
      // Probar cada resultado posible para este partido
      for (const result of ALL_POSSIBLE_MATCH_RESULTS) {
        const outcome: MatchOutcome = {
          matchId: currentMatch.id,
          couple1Id: currentMatch.couple1_id,
          couple2Id: currentMatch.couple2_id,
          couple1Games: result.couple1Games,
          couple2Games: result.couple2Games,
          winnerId: result.winner === 'couple1' ? currentMatch.couple1_id : currentMatch.couple2_id
        }
        
        currentOutcomes.push(outcome)
        backtrack(matchIndex + 1, currentOutcomes)
        currentOutcomes.pop()
      }
    }
    
    backtrack(0, [])
    return allOutcomes
  }
  
  /**
   * Simula el estado final de la zona con resultados específicos
   */
  private simulateZoneWithOutcomes(
    originalCouples: CoupleStats[],
    pendingMatches: PendingMatch[],
    outcomes: MatchOutcome[]
  ): CoupleStats[] {
    
    // Crear clave de caché
    const cacheKey = outcomes
      .map(o => `${o.matchId}:${o.winnerId}:${o.couple1Games}-${o.couple2Games}`)
      .sort()
      .join('|')
    
    if (this.simulationCache.has(cacheKey)) {
      return this.simulationCache.get(cacheKey)!
    }
    
    // Crear copia de las estadísticas actuales
    const updatedCouples = originalCouples.map(couple => ({
      ...couple,
      matchesWon: couple.matchesWon,
      matchesLost: couple.matchesLost,
      gamesWon: couple.gamesWon,
      gamesLost: couple.gamesLost,
      gamesDifference: couple.gamesDifference
    }))
    
    // Aplicar cada resultado simulado
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
    
    // Aplicar el algoritmo de ranking completo (usar el existente)
    const finalRanking = this.rankingEngine.rankCouplesByAllCriteria(updatedCouples, [])
    
    // Guardar en caché
    this.simulationCache.set(cacheKey, finalRanking)
    
    return finalRanking
  }
  
  /**
   * Obtener datos actuales de la zona
   */
  private async fetchZoneData(zoneId: string): Promise<{
    couples: CoupleStats[]
    pendingMatches: PendingMatch[]
  }> {
    const supabase = createClient()
    
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
      player1Name: pos.couples?.player1?.first_name + ' ' + pos.couples?.player1?.last_name,
      player2Name: pos.couples?.player2?.first_name + ' ' + pos.couples?.player2?.last_name,
      position: pos.position,
      matchesWon: pos.wins,
      matchesLost: pos.losses,
      matchesPlayed: pos.wins + pos.losses,
      gamesWon: pos.games_for,
      gamesLost: pos.games_against,
      gamesDifference: pos.games_difference,
      totalPlayerScore: pos.player_score_total,
      positionTieInfo: '',
      // Campos adicionales requeridos por la interfaz
      player1Score: 0,
      player2Score: 0,
      setsWon: 0,
      setsLost: 0,
      setsDifference: 0
    }))
    
    return {
      couples,
      pendingMatches: matches || []
    }
  }
}