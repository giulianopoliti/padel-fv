/**
 * HOOK DE MODO EDICIÓN SIMPLE
 * 
 * Hook para manejar edición de brackets con clicks simples en lugar de drag & drop.
 * Permite seleccionar parejas, marcar destinos, y guardar cambios en batch.
 * 
 * FLUJO:
 * 1. Activar "Modo Edición"
 * 2. Click en pareja -> Seleccionar origen
 * 3. Click en destino -> Marcar intercambio pendiente
 * 4. Repetir para múltiples cambios
 * 5. Click "Guardar Cambios" -> Ejecutar todos los intercambios
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 * @created 2025-01-18
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import type {
  BracketMatchV2,
  CoupleData,
  ParticipantSlot
} from '../types/bracket-types'

// ============================================================================
// TIPOS DEL HOOK
// ============================================================================

/**
 * Posición de slot (slot1 o slot2)
 */
export type SlotPosition = 'slot1' | 'slot2'

/**
 * Pareja seleccionada para intercambio
 */
export interface SelectedCouple {
  /** ID único de la selección */
  selectionId: string
  /** Pareja seleccionada */
  couple: CoupleData
  /** Match origen */
  sourceMatch: BracketMatchV2
  /** Posición en el match origen */
  sourceSlot: SlotPosition
  /** Timestamp de selección */
  selectedAt: string
}

/**
 * Intercambio pendiente
 */
export interface PendingSwap {
  /** ID único del intercambio */
  swapId: string
  /** Pareja origen */
  source: SelectedCouple
  /** Match destino */
  targetMatch: BracketMatchV2
  /** Slot destino */
  targetSlot: SlotPosition
  /** Pareja destino (puede ser null si slot vacío) */
  targetCouple: CoupleData | null
  /** Tipo de operación */
  operationType: 'move' | 'swap'
  /** Timestamp de creación */
  createdAt: string
}

/**
 * Estado de validación
 */
export interface ValidationResult {
  /** Si es válido */
  isValid: boolean
  /** Mensaje de error si no es válido */
  message?: string
  /** Tipo de advertencia */
  warningType?: 'info' | 'warning' | 'error'
}

/**
 * Configuración del modo edición
 */
export interface EditModeConfig {
  /** Si está habilitado */
  enabled: boolean
  /** Solo owners pueden editar */
  ownerOnly: boolean
  /** Máximo número de intercambios pendientes */
  maxPendingSwaps: number
  /** Auto-guardar después de N segundos */
  autoSaveTimeout?: number
  /** Validaciones en tiempo real */
  realtimeValidation: boolean
}

/**
 * Estado del modo edición
 */
export interface EditModeState {
  /** Si está activo */
  isActive: boolean
  /** Pareja actualmente seleccionada */
  selectedCouple: SelectedCouple | null
  /** Lista de intercambios pendientes */
  pendingSwaps: PendingSwap[]
  /** Si está guardando */
  isSaving: boolean
  /** Errores */
  errors: string[]
  /** Estado de validación general */
  validation: ValidationResult
}

/**
 * Resultado de operación de guardado
 */
export interface SaveResult {
  /** Si fue exitoso */
  success: boolean
  /** Número de intercambios procesados */
  processedSwaps: number
  /** Errores encontrados */
  errors: string[]
  /** Tiempo de procesamiento */
  duration: number
}

// ============================================================================
// CONFIGURACIÓN POR DEFECTO
// ============================================================================

const DEFAULT_CONFIG: EditModeConfig = {
  enabled: true,
  ownerOnly: true,
  maxPendingSwaps: 10,
  realtimeValidation: true
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

/**
 * Hook principal para modo edición
 */
export function useEditMode(
  tournamentId: string,
  isOwner: boolean = false,
  config: Partial<EditModeConfig> = {}
) {
  
  // Configuración final
  const finalConfig = useMemo((): EditModeConfig => ({
    ...DEFAULT_CONFIG,
    ...config
  }), [config])

  // Estado principal
  const [state, setState] = useState<EditModeState>({
    isActive: false,
    selectedCouple: null,
    pendingSwaps: [],
    isSaving: false,
    errors: [],
    validation: { isValid: true }
  })

  // ============================================================================
  // FUNCIONES DE VALIDACIÓN
  // ============================================================================

  /**
   * Valida si se puede seleccionar una pareja
   */
  const canSelectCouple = useCallback((
    couple: CoupleData,
    match: BracketMatchV2,
    slot: SlotPosition
  ): ValidationResult => {
    
    if (!finalConfig.enabled) {
      return { isValid: false, message: 'Modo edición deshabilitado' }
    }

    if (finalConfig.ownerOnly && !isOwner) {
      return { isValid: false, message: 'Solo owners pueden editar' }
    }

    if (!state.isActive) {
      return { isValid: false, message: 'Modo edición no está activo' }
    }

    if (match.status !== 'PENDING') {
      return { isValid: false, message: 'No se pueden editar matches en progreso o finalizados' }
    }

    return { isValid: true }
  }, [finalConfig, isOwner, state.isActive])

  /**
   * Valida si se puede hacer un intercambio a una posición
   */
  const canSwapToPosition = useCallback((
    targetMatch: BracketMatchV2,
    targetSlot: SlotPosition,
    selectedCouple: SelectedCouple
  ): ValidationResult => {
    
    // Validaciones básicas
    if (!state.isActive || !selectedCouple) {
      return { isValid: false, message: 'No hay pareja seleccionada' }
    }

    if (targetMatch.status !== 'PENDING') {
      return { isValid: false, message: 'No se puede intercambiar a matches no pendientes' }
    }

    // No se puede mover a la misma posición
    if (selectedCouple.sourceMatch.id === targetMatch.id && 
        selectedCouple.sourceSlot === targetSlot) {
      return { isValid: false, message: 'No se puede mover a la misma posición' }
    }

    // Debe ser la misma ronda
    if (selectedCouple.sourceMatch.round !== targetMatch.round) {
      return { isValid: false, message: 'Solo se puede intercambiar dentro de la misma ronda' }
    }

    // Verificar límite de intercambios pendientes
    if (state.pendingSwaps.length >= finalConfig.maxPendingSwaps) {
      return { isValid: false, message: `Máximo ${finalConfig.maxPendingSwaps} intercambios pendientes` }
    }

    // Verificar que no haya intercambio duplicado
    const existingSwap = state.pendingSwaps.find(swap =>
      swap.source.sourceMatch.id === selectedCouple.sourceMatch.id &&
      swap.source.sourceSlot === selectedCouple.sourceSlot &&
      swap.targetMatch.id === targetMatch.id &&
      swap.targetSlot === targetSlot
    )

    if (existingSwap) {
      return { isValid: false, message: 'Este intercambio ya está pendiente' }
    }

    return { isValid: true }
  }, [state, finalConfig.maxPendingSwaps])

  // ============================================================================
  // ACCIONES PRINCIPALES
  // ============================================================================

  /**
   * Activar/desactivar modo edición
   */
  const toggleEditMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: !prev.isActive,
      selectedCouple: null, // Limpiar selección al cambiar modo
      errors: []
    }))
  }, [])

  /**
   * Seleccionar una pareja
   */
  const selectCouple = useCallback((
    couple: CoupleData,
    match: BracketMatchV2,
    slot: SlotPosition
  ) => {
    const validation = canSelectCouple(couple, match, slot)
    
    if (!validation.isValid) {
      setState(prev => ({
        ...prev,
        errors: [...prev.errors, validation.message!]
      }))
      return false
    }

    const selection: SelectedCouple = {
      selectionId: `sel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      couple,
      sourceMatch: match,
      sourceSlot: slot,
      selectedAt: new Date().toISOString()
    }

    setState(prev => ({
      ...prev,
      selectedCouple: selection,
      errors: prev.errors.filter(e => !e.includes('seleccionar')) // Limpiar errores de selección
    }))

    return true
  }, [canSelectCouple])

  /**
   * Crear intercambio a posición destino
   */
  const swapToPosition = useCallback((
    targetMatch: BracketMatchV2,
    targetSlot: SlotPosition
  ) => {
    if (!state.selectedCouple) {
      setState(prev => ({
        ...prev,
        errors: [...prev.errors, 'No hay pareja seleccionada']
      }))
      return false
    }

    const validation = canSwapToPosition(targetMatch, targetSlot, state.selectedCouple)
    
    if (!validation.isValid) {
      setState(prev => ({
        ...prev,
        errors: [...prev.errors, validation.message!]
      }))
      return false
    }

    // Obtener pareja destino si existe
    const targetSlotData = targetMatch.participants[targetSlot]
    const targetCouple = targetSlotData.type === 'couple' ? targetSlotData.couple : null

    // Crear intercambio pendiente
    const pendingSwap: PendingSwap = {
      swapId: `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: state.selectedCouple,
      targetMatch,
      targetSlot,
      targetCouple,
      operationType: targetCouple ? 'swap' : 'move',
      createdAt: new Date().toISOString()
    }

    setState(prev => ({
      ...prev,
      pendingSwaps: [...prev.pendingSwaps, pendingSwap],
      selectedCouple: null, // Limpiar selección después de crear intercambio
      errors: prev.errors.filter(e => !e.includes('intercambiar')) // Limpiar errores de intercambio
    }))

    return true
  }, [state.selectedCouple, canSwapToPosition])

  /**
   * Cancelar intercambio pendiente
   */
  const cancelSwap = useCallback((swapId: string) => {
    setState(prev => ({
      ...prev,
      pendingSwaps: prev.pendingSwaps.filter(swap => swap.swapId !== swapId)
    }))
  }, [])

  /**
   * Limpiar toda la selección
   */
  const clearSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedCouple: null,
      errors: []
    }))
  }, [])

  /**
   * Limpiar todos los intercambios pendientes
   */
  const clearAllPendingSwaps = useCallback(() => {
    setState(prev => ({
      ...prev,
      pendingSwaps: [],
      selectedCouple: null,
      errors: []
    }))
  }, [])

  /**
   * Guardar todos los cambios
   */
  const saveChanges = useCallback(async (): Promise<SaveResult> => {
    if (state.pendingSwaps.length === 0) {
      return {
        success: true,
        processedSwaps: 0,
        errors: [],
        duration: 0
      }
    }

    setState(prev => ({ ...prev, isSaving: true }))
    const startTime = performance.now()
    const errors: string[] = []
    let processedSwaps = 0

    try {
      // Procesar intercambios en serie para evitar conflictos
      for (const swap of state.pendingSwaps) {
        try {
          const response = await fetch(`/api/tournaments/${tournamentId}/swap-bracket-positions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              sourceMatchId: swap.source.sourceMatch.id,
              targetMatchId: swap.targetMatch.id,
              sourceSlot: swap.source.sourceSlot === 'slot1' ? 'couple1_id' : 'couple2_id',
              targetSlot: swap.targetSlot === 'slot1' ? 'couple1_id' : 'couple2_id',
              operationId: swap.swapId
            })
          })

          if (!response.ok) {
            const errorText = await response.text()
            errors.push(`Error en intercambio ${swap.swapId}: ${response.status} ${errorText}`)
            continue
          }

          const result = await response.json()
          if (!result.success) {
            errors.push(`Error en intercambio ${swap.swapId}: ${result.error}`)
            continue
          }

          processedSwaps++
        } catch (error) {
          errors.push(`Error en intercambio ${swap.swapId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      const duration = performance.now() - startTime
      const success = errors.length === 0

      // Limpiar estado si todo fue exitoso
      if (success) {
        setState(prev => ({
          ...prev,
          pendingSwaps: [],
          selectedCouple: null,
          isSaving: false,
          errors: []
        }))
      } else {
        setState(prev => ({
          ...prev,
          isSaving: false,
          errors: [...prev.errors, ...errors]
        }))
      }

      return {
        success,
        processedSwaps,
        errors,
        duration
      }

    } catch (error) {
      setState(prev => ({
        ...prev,
        isSaving: false,
        errors: [...prev.errors, `Error general: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }))

      return {
        success: false,
        processedSwaps,
        errors: [...errors, error instanceof Error ? error.message : 'Unknown error'],
        duration: performance.now() - startTime
      }
    }
  }, [state.pendingSwaps, tournamentId])

  // ============================================================================
  // FUNCIONES DE UTILIDAD
  // ============================================================================

  /**
   * Verificar si una posición está seleccionada
   */
  const isPositionSelected = useCallback((matchId: string, slot: SlotPosition): boolean => {
    return state.selectedCouple?.sourceMatch.id === matchId && 
           state.selectedCouple?.sourceSlot === slot
  }, [state.selectedCouple])

  /**
   * Verificar si una posición tiene intercambio pendiente
   */
  const hasPendingSwap = useCallback((matchId: string, slot: SlotPosition): PendingSwap | null => {
    return state.pendingSwaps.find(swap =>
      (swap.source.sourceMatch.id === matchId && swap.source.sourceSlot === slot) ||
      (swap.targetMatch.id === matchId && swap.targetSlot === slot)
    ) || null
  }, [state.pendingSwaps])

  /**
   * Obtener estadísticas del estado actual
   */
  const getStats = useCallback(() => ({
    isActive: state.isActive,
    hasSelection: !!state.selectedCouple,
    pendingSwapsCount: state.pendingSwaps.length,
    errorsCount: state.errors.length,
    canSave: state.pendingSwaps.length > 0 && !state.isSaving,
    maxSwapsReached: state.pendingSwaps.length >= finalConfig.maxPendingSwaps
  }), [state, finalConfig.maxPendingSwaps])

  // ============================================================================
  // RETORNO DEL HOOK
  // ============================================================================

  return {
    // Estado
    state,
    config: finalConfig,
    
    // Acciones principales
    toggleEditMode,
    selectCouple,
    swapToPosition,
    cancelSwap,
    clearSelection,
    clearAllPendingSwaps,
    saveChanges,
    
    // Validaciones
    canSelectCouple,
    canSwapToPosition,
    
    // Utilidades
    isPositionSelected,
    hasPendingSwap,
    getStats
  }
}

export default useEditMode