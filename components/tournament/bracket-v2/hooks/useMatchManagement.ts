/**
 * Hook reutilizable para gestión completa de matches
 * Maneja asignación de cancha, inicio de match, resultados y modificaciones
 * 
 * Extensible para torneos de 1 set y futuros torneos de 3 sets
 */

import { useState, useCallback } from 'react'
import { toast } from 'sonner'

// Tipos base - extensibles para diferentes formatos
export interface MatchSet {
  couple1_games: number
  couple2_games: number
}

export interface MatchResult {
  format: 'single_set' | 'best_of_3'
  sets: MatchSet[]
  winner_id: string
  match_duration_minutes?: number
  notes?: string
  final_score?: string
  // ✅ NUEVOS CAMPOS para compatibilidad con torneos largos
  sets_won_couple1?: string  // "2" para sets ganados
  sets_won_couple2?: string  // "1" para sets ganados
}

export interface MatchManagementState {
  // Estados de operaciones
  assigningCourt: boolean
  startingMatch: boolean
  updatingResult: boolean
  
  // Datos del match actual
  currentMatch?: {
    id: string
    status: string
    court?: string
    couple1_id?: string
    couple2_id?: string
    result?: MatchResult
  }
  
  // Errores
  error?: string
}

export interface MatchManagementActions {
  // Asignación de cancha
  assignCourt: (matchId: string, court: string, startMatch?: boolean) => Promise<boolean>
  
  // Gestión de resultados
  updateResult: (matchId: string, result: MatchResult, finishMatch?: boolean) => Promise<boolean>
  modifyResult: (matchId: string, newResult: MatchResult) => Promise<boolean>
  
  // Helpers para construcción de resultados
  createSingleSetResult: (couple1Games: number, couple2Games: number, winnerId: string, duration?: number) => MatchResult
  createBestOf3Result: (sets: MatchSet[], winnerId: string, duration?: number) => MatchResult
  
  // Validaciones
  validateResult: (result: MatchResult, couple1Id: string, couple2Id: string) => { valid: boolean; error?: string }
  
  // Reset de estados
  clearError: () => void
  resetState: () => void
}

export function useMatchManagement(
  tournamentId: string,
  onMatchUpdate?: (matchId: string, updatedData: any) => void,
  onError?: (error: string) => void
): [MatchManagementState, MatchManagementActions] {
  
  const [state, setState] = useState<MatchManagementState>({
    assigningCourt: false,
    startingMatch: false,
    updatingResult: false
  })

  // Función helper para actualizar estado
  const updateState = useCallback((updates: Partial<MatchManagementState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  // Función helper para manejar errores
  const handleError = useCallback((error: string, operation: string) => {
    console.error(`[useMatchManagement] ${operation} failed:`, error)
    updateState({ error })
    onError?.(error)
    toast.error(`Error en ${operation}: ${error}`)
  }, [updateState, onError])

  // Asignar cancha (y opcionalmente iniciar match)
  const assignCourt = useCallback(async (
    matchId: string, 
    court: string, 
    startMatch = false
  ): Promise<boolean> => {
    if (!court.trim()) {
      handleError('Cancha es requerida', 'asignación de cancha')
      return false
    }

    updateState({ 
      assigningCourt: true, 
      startingMatch: startMatch,
      error: undefined 
    })

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/matches/${matchId}/assign-court`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ court: court.trim(), startMatch })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        handleError(data.error || 'Error desconocido', startMatch ? 'inicio de match' : 'asignación de cancha')
        return false
      }

      // Notificar actualización
      onMatchUpdate?.(matchId, {
        court: data.court,
        status: data.status
      })

      toast.success(
        startMatch 
          ? `Match iniciado en ${data.court}` 
          : `Cancha ${data.court} asignada`
      )

      return true

    } catch (error) {
      handleError(
        error instanceof Error ? error.message : 'Error de conexión',
        startMatch ? 'inicio de match' : 'asignación de cancha'
      )
      return false
    } finally {
      updateState({ assigningCourt: false, startingMatch: false })
    }
  }, [tournamentId, handleError, updateState, onMatchUpdate])

  // Actualizar resultado del match
  const updateResult = useCallback(async (
    matchId: string,
    result: MatchResult,
    finishMatch = true
  ): Promise<boolean> => {
    updateState({ updatingResult: true, error: undefined })

    try {
      // ✅ DETECTAR ENDPOINT SEGÚN FORMATO
      const endpoint = result.format === 'best_of_3'
        ? `/api/tournaments/${tournamentId}/matches/${matchId}/universal-result`
        : `/api/tournaments/${tournamentId}/matches/${matchId}/update-result`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, finishMatch })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        handleError(data.error || 'Error desconocido', 'actualización de resultado')
        return false
      }

      // Notificar actualización
      onMatchUpdate?.(matchId, {
        result: data.result,
        status: data.status,
        winner_id: result.winner_id,
        tournamentFinalized: data.tournamentFinalized // ← NUEVO: pasar info de finalización
      })

      // Notificaciones mejoradas para modificaciones
      if (data.modification && data.modification.winnerChanged) {
        const affectedCount = data.modification.cascadeInfo?.affectedMatches || 0
        toast.success(
          `Resultado modificado. Nuevo ganador propagado${affectedCount > 0 ? ` (${affectedCount} matches afectados)` : ''}`
        )
      } else if (data.propagated) {
        const operationType = data.propagated.operation === 'modification' ? 'modificado' : 'guardado'
        toast.success(
          `Resultado ${operationType}. Ganador avanzó a siguiente ronda`
        )
      } else {
        toast.success(finishMatch ? 'Match finalizado' : 'Resultado actualizado')
      }

      return true

    } catch (error) {
      handleError(
        error instanceof Error ? error.message : 'Error de conexión',
        'actualización de resultado'
      )
      return false
    } finally {
      updateState({ updatingResult: false })
    }
  }, [tournamentId, handleError, updateState, onMatchUpdate])

  // Modificar resultado existente (caso especial)
  const modifyResult = useCallback(async (
    matchId: string, 
    newResult: MatchResult
  ): Promise<boolean> => {
    // Usar la misma función pero con lógica de modificación
    return updateResult(matchId, newResult, true)
  }, [updateResult])

  // Helper: Crear resultado de 1 set
  const createSingleSetResult = useCallback((
    couple1Games: number,
    couple2Games: number,
    winnerId: string,
    duration?: number
  ): MatchResult => {
    return {
      format: 'single_set',
      sets: [{ couple1_games: couple1Games, couple2_games: couple2Games }],
      winner_id: winnerId,
      match_duration_minutes: duration,
      final_score: `${couple1Games}-${couple2Games}`
    }
  }, [])

  // Helper: Crear resultado de 3 sets (para torneos largos)
  const createBestOf3Result = useCallback((
    sets: MatchSet[],
    winnerId: string,
    duration?: number
  ): MatchResult => {
    const finalScore = sets.map(set => `${set.couple1_games}-${set.couple2_games}`).join(', ')

    // ✅ CALCULAR SETS GANADOS (para result_couple1/result_couple2)
    const [couple1Sets, couple2Sets] = sets.reduce(
      (acc, set) => {
        if (set.couple1_games > set.couple2_games) acc[0]++
        else acc[1]++
        return acc
      },
      [0, 0]
    )

    return {
      format: 'best_of_3',
      sets,
      winner_id: winnerId,
      match_duration_minutes: duration,
      final_score: finalScore,
      // ✅ NUEVOS CAMPOS para compatibilidad
      sets_won_couple1: couple1Sets.toString(),  // "2"
      sets_won_couple2: couple2Sets.toString()   // "1"
    }
  }, [])

  // Validar resultado
  const validateResult = useCallback((
    result: MatchResult,
    couple1Id: string,
    couple2Id: string
  ): { valid: boolean; error?: string } => {
    // Validar que el ganador es una de las parejas
    if (result.winner_id !== couple1Id && result.winner_id !== couple2Id) {
      return { valid: false, error: 'El ganador debe ser una de las parejas del match' }
    }

    // Validar que hay al menos 1 set
    if (!result.sets || result.sets.length === 0) {
      return { valid: false, error: 'Debe haber al menos 1 set' }
    }

    // Validar format vs cantidad de sets
    if (result.format === 'single_set' && result.sets.length !== 1) {
      return { valid: false, error: 'Formato single set debe tener exactamente 1 set' }
    }

    if (result.format === 'best_of_3' && (result.sets.length < 2 || result.sets.length > 3)) {
      return { valid: false, error: 'Formato best of 3 debe tener 2 o 3 sets' }
    }

    // Validar games por set (deben ser válidos)
    for (const set of result.sets) {
      if (set.couple1_games < 0 || set.couple2_games < 0) {
        return { valid: false, error: 'Los games no pueden ser negativos' }
      }
      
      if (set.couple1_games > 7 || set.couple2_games > 7) {
        return { valid: false, error: 'Los games no pueden ser mayores a 7' }
      }

      // Al menos una pareja debe llegar a 6
      if (Math.max(set.couple1_games, set.couple2_games) < 6) {
        return { valid: false, error: 'Al menos una pareja debe llegar a 6 games' }
      }
    }

    return { valid: true }
  }, [])

  // Limpiar error
  const clearError = useCallback(() => {
    updateState({ error: undefined })
  }, [updateState])

  // Reset completo del estado
  const resetState = useCallback(() => {
    setState({
      assigningCourt: false,
      startingMatch: false,
      updatingResult: false,
      currentMatch: undefined,
      error: undefined
    })
  }, [])

  // Acciones
  const actions: MatchManagementActions = {
    assignCourt,
    updateResult,
    modifyResult,
    createSingleSetResult,
    createBestOf3Result,
    validateResult,
    clearError,
    resetState
  }

  return [state, actions]
}