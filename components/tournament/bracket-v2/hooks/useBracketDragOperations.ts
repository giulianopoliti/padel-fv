/**
 * Bracket Drag & Drop Operations Hook
 * 
 * Hook principal que maneja todas las operaciones de drag & drop en brackets.
 * Incluye validaciones, operaciones batch y comunicación con API.
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 * @created 2025-01-18
 */

'use client'

import { useCallback, useMemo } from 'react'
import { useBracketDragDrop } from '../context/bracket-drag-context'
import { toast } from 'sonner'
import type {
  BracketDragItem,
  BracketDropTarget,
  BracketSwapOperation,
  BracketOperationType,
  BracketDragDropConfig,
  BracketSaveResult
} from '../types/bracket-drag-types'
import type {
  BracketMatchV2,
  CoupleData,
  ParticipantSlot
} from '../types/bracket-types'

// ============================================================================
// CONFIGURACIÓN POR DEFECTO
// ============================================================================

const DEFAULT_CONFIG: BracketDragDropConfig = {
  enabled: true,
  ownerOnly: true,
  sameRoundOnly: true,
  pendingMatchesOnly: true,
  maxPendingOperations: 10,
  autoSaveTimeout: 0, // Deshabilitado por defecto
  visual: {
    showDropZones: true,
    enableAnimations: true,
    hapticFeedback: false
  }
}

// ============================================================================
// TIPOS DEL HOOK
// ============================================================================

interface UseBracketDragOperationsConfig {
  /** ID del torneo */
  tournamentId: string
  /** Si es owner */
  isOwner: boolean
  /** Configuración personalizada */
  config?: Partial<BracketDragDropConfig>
}

interface UseBracketDragOperationsResult {
  /** Estado del drag & drop */
  isDragging: boolean
  draggedItem: BracketDragItem | null
  dragOverTarget: BracketDropTarget | null
  
  /** Operaciones pendientes */
  pendingOperations: BracketSwapOperation[]
  hasPendingOperations: boolean
  
  /** Configuración final */
  config: BracketDragDropConfig
  
  /** Acciones de drag */
  startDrag: (couple: CoupleData, match: BracketMatchV2, slot: 'slot1' | 'slot2') => void
  endDrag: () => void
  setDragOver: (target: BracketDropTarget | null) => void
  
  /** Acciones de drop */
  handleDrop: (targetMatch: BracketMatchV2, targetSlot: 'slot1' | 'slot2') => void
  
  /** Validaciones */
  canDragCouple: (couple: CoupleData, match: BracketMatchV2, slot: 'slot1' | 'slot2') => { canDrag: boolean; reason?: string }
  canDropToSlot: (targetMatch: BracketMatchV2, targetSlot: 'slot1' | 'slot2') => { canDrop: boolean; reason?: string }
  
  /** Operaciones batch */
  saveAllOperations: () => Promise<BracketSaveResult>
  clearPendingOperations: () => void
  
  /** Utilidades */
  createDropTarget: (match: BracketMatchV2, slot: 'slot1' | 'slot2') => BracketDropTarget
  determineOperationType: (match: BracketMatchV2, slot: 'slot1' | 'slot2') => BracketOperationType
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function useBracketDragOperations({
  tournamentId,
  isOwner,
  config: customConfig = {}
}: UseBracketDragOperationsConfig): UseBracketDragOperationsResult {
  
  // Context de drag & drop
  const { state, actions } = useBracketDragDrop()
  
  // Configuración final
  const config = useMemo((): BracketDragDropConfig => ({
    ...DEFAULT_CONFIG,
    ...customConfig
  }), [customConfig])
  
  // Estados derivados
  const hasPendingOperations = state.pendingOperations.length > 0
  
  // ============================================================================
  // VALIDACIONES
  // ============================================================================
  
  /**
   * Determina el tipo de operación según el estado del slot destino
   */
  const determineOperationType = useCallback((
    targetMatch: BracketMatchV2,
    targetSlot: 'slot1' | 'slot2'
  ): BracketOperationType => {
    const targetParticipant = targetMatch.participants?.[targetSlot]
    
    if (!targetParticipant) {
      return 'move-to-empty' // Slot completamente vacío
    }
    
    if (targetParticipant.type === 'couple' && targetParticipant.couple) {
      return 'swap' // Hay otra pareja, será intercambio
    }
    
    if (targetParticipant.type === 'placeholder') {
      return 'move-to-placeholder' // Slot con placeholder (ej. "Ganador Partido X")
    }
    
    return 'move-to-empty' // Fallback para slots vacíos
  }, [])
  
  /**
   * Valida si se puede arrastrar una pareja
   */
  const canDragCouple = useCallback((
    couple: CoupleData, 
    match: BracketMatchV2, 
    slot: 'slot1' | 'slot2'
  ): { canDrag: boolean; reason?: string } => {
    
    if (!config.enabled) {
      return { canDrag: false, reason: 'Drag & drop deshabilitado' }
    }
    
    if (config.ownerOnly && !isOwner) {
      return { canDrag: false, reason: 'Solo owners pueden reorganizar el bracket' }
    }
    
    // ✅ VALIDACIÓN MEJORADA: partidos finalizados no se pueden modificar
    if (match.status === 'FINISHED') {
      return { canDrag: false, reason: 'No se pueden mover parejas de matches finalizados' }
    }
    
    if (config.pendingMatchesOnly && match.status !== 'PENDING') {
      return { canDrag: false, reason: 'Solo se pueden mover parejas de matches pendientes' }
    }
    
    if (!couple) {
      return { canDrag: false, reason: 'No hay pareja en esta posición' }
    }
    
    // Verificar límite de operaciones pendientes
    if (state.pendingOperations.length >= config.maxPendingOperations) {
      return { canDrag: false, reason: `Máximo ${config.maxPendingOperations} operaciones pendientes` }
    }
    
    return { canDrag: true }
  }, [config, isOwner, state.pendingOperations.length])
  
  /**
   * Valida si se puede soltar en una posición
   */
  const canDropToSlot = useCallback((
    targetMatch: BracketMatchV2, 
    targetSlot: 'slot1' | 'slot2'
  ): { canDrop: boolean; reason?: string } => {
    
    if (!state.draggedItem) {
      return { canDrop: false, reason: 'No hay elemento siendo arrastrado' }
    }
    
    // ✅ VALIDACIÓN MEJORADA: partidos finalizados no se pueden modificar  
    if (targetMatch.status === 'FINISHED') {
      return { canDrop: false, reason: 'No se puede soltar en matches finalizados' }
    }
    
    if (config.pendingMatchesOnly && targetMatch.status !== 'PENDING') {
      return { canDrop: false, reason: 'Solo se puede soltar en matches pendientes' }
    }
    
    // Verificar que no sea la misma posición
    if (state.draggedItem.sourceMatchId === targetMatch.id && 
        state.draggedItem.sourceSlot === targetSlot) {
      return { canDrop: false, reason: 'No se puede soltar en la misma posición' }
    }
    
    // ✅ VALIDACIÓN MEJORADA: no se puede mover entre rondas diferentes
    if (config.sameRoundOnly && state.draggedItem.sourceRound !== targetMatch.round) {
      return { canDrop: false, reason: `No se puede mover entre rondas diferentes (${state.draggedItem.sourceRound} → ${targetMatch.round})` }
    }
    
    // Verificar que no haya operación duplicada
    const duplicateOperation = state.pendingOperations.find(op =>
      op.sourceItem.sourceMatchId === state.draggedItem!.sourceMatchId &&
      op.sourceItem.sourceSlot === state.draggedItem!.sourceSlot &&
      op.targetSlot.matchId === targetMatch.id &&
      op.targetSlot.slot === targetSlot
    )
    
    if (duplicateOperation) {
      return { canDrop: false, reason: 'Este intercambio ya está pendiente' }
    }
    
    // ✅ NUEVA VALIDACIÓN: determinar tipo de operación y validar coherencia
    const operationType = determineOperationType(targetMatch, targetSlot)
    
    // Validaciones específicas por tipo de operación
    switch (operationType) {
      case 'swap':
        // Para intercambios, verificar que ambas parejas existan
        const targetParticipant = targetMatch.participants?.[targetSlot]
        if (!targetParticipant?.couple) {
          return { canDrop: false, reason: 'Error: se esperaba intercambio pero no hay pareja destino' }
        }
        break
        
      case 'move-to-placeholder':
        // Para placeholders, validar que sea correcto mover ahí
        const placeholder = targetMatch.participants?.[targetSlot]?.placeholder
        if (placeholder?.display?.includes('Ganador') || placeholder?.display?.includes('Perdedor')) {
          // Opcional: validar que viene del match correcto (lo implementaremos después)
          console.log(`🔍 [Validation] Moviendo a placeholder: ${placeholder.display}`)
        }
        break
        
      case 'move-to-empty':
        // Para slots vacíos, no hay validaciones extra por ahora
        break
    }
    
    return { canDrop: true }
  }, [state.draggedItem, state.pendingOperations, config, determineOperationType])
  
  // ============================================================================
  // ACCIONES DE DRAG
  // ============================================================================
  
  /**
   * Inicia el arrastre de una pareja
   */
  const startDrag = useCallback((
    couple: CoupleData, 
    match: BracketMatchV2, 
    slot: 'slot1' | 'slot2'
  ) => {
    const validation = canDragCouple(couple, match, slot)
    
    if (!validation.canDrag) {
      toast.error(validation.reason || 'No se puede arrastrar esta pareja')
      return
    }
    
    // Crear objeto de drag item
    const dragItem: BracketDragItem = {
      type: 'bracket-couple',
      coupleId: couple.id,
      coupleName: `${couple.player1_details?.first_name || ''} & ${couple.player2_details?.first_name || ''}`,
      sourceMatchId: match.id,
      sourceSlot: slot,
      sourceRound: match.round,
      sourceBracketPosition: match.order_in_round,
      sourceZoneId: couple.seed?.zone_id || null,
      sourceZoneName: couple.seed?.zone_name || null
    }
    
    actions.startDrag(dragItem)
    
    if (config.visual.hapticFeedback && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(50)
    }
    
    toast(`Arrastrando: ${dragItem.coupleName}`, { duration: 1000 })
  }, [canDragCouple, actions, config])
  
  /**
   * Termina el arrastre
   */
  const endDrag = useCallback(() => {
    actions.endDrag()
  }, [actions])
  
  /**
   * Establece el target de hover
   */
  const setDragOver = useCallback((target: BracketDropTarget | null) => {
    actions.setDragOver(target)
  }, [actions])
  
  // ============================================================================
  // ACCIONES DE DROP
  // ============================================================================
  
  /**
   * Maneja el drop en una posición
   */
  const handleDrop = useCallback((
    targetMatch: BracketMatchV2, 
    targetSlot: 'slot1' | 'slot2'
  ) => {
    if (!state.draggedItem) {
      toast.error('No hay elemento siendo arrastrado')
      return
    }
    
    const validation = canDropToSlot(targetMatch, targetSlot)
    
    if (!validation.canDrop) {
      toast.error(validation.reason || 'No se puede soltar aquí')
      return
    }
    
    // ✅ NUEVO: Determinar tipo de operación
    const operationType = determineOperationType(targetMatch, targetSlot)
    
    // Crear target de drop
    const dropTarget = createDropTarget(targetMatch, targetSlot)
    
    // Obtener información del destino según el tipo de operación
    const targetParticipant = targetMatch.participants?.[targetSlot]
    const targetCouple = (operationType === 'swap' && targetParticipant?.type === 'couple') 
      ? targetParticipant.couple : null
    const targetPlaceholder = (operationType === 'move-to-placeholder' && targetParticipant?.type === 'placeholder')
      ? {
          originalLabel: targetParticipant.placeholder?.display || '',
          sourceMatchId: targetParticipant.placeholder?.sourceMatchId || undefined,
          zoneId: targetParticipant.placeholder?.zoneId || targetParticipant.placeholder?.rule.zoneId || null,
          zoneName: targetParticipant.placeholder?.zoneName || null,
          position: targetParticipant.placeholder?.position || targetParticipant.placeholder?.rule.position || null
        } : null
    
    // ✅ MEJORADO: Crear operación con tipo específico
    const operation: BracketSwapOperation = {
      type: 'bracket-swap',
      operationId: `${operationType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operationType, // ✅ NUEVO campo
      sourceItem: state.draggedItem,
      targetSlot: dropTarget,
      targetCouple: targetCouple ? {
        coupleId: targetCouple.id,
        coupleName: `${targetCouple.player1_details?.first_name || ''} & ${targetCouple.player2_details?.first_name || ''}`
      } : null,
      targetPlaceholder, // ✅ NUEVO campo
      createdAt: new Date().toISOString()
    }
    
    // Agregar operación pendiente
    actions.addPendingOperation(operation)
    
    // ✅ MEJORADO: Feedback específico por tipo de operación
    let message: string
    let icon: string
    
    switch (operationType) {
      case 'swap':
        message = `🔄 Intercambio programado: ${operation.sourceItem.coupleName} ↔ ${operation.targetCouple?.coupleName}`
        icon = '🔄'
        break
      case 'move-to-placeholder':
        message = `📥 Movimiento a placeholder: ${operation.sourceItem.coupleName} → ${targetPlaceholder?.originalLabel}`
        icon = '📥'
        break
      case 'move-to-empty':
        message = `📍 Movimiento a slot vacío: ${operation.sourceItem.coupleName} → ${targetMatch.round} ${targetSlot.toUpperCase()}`
        icon = '📍'
        break
      default:
        message = `Operación programada: ${operation.sourceItem.coupleName}`
        icon = '✅'
    }
    
    toast.success(message, { duration: 3000 })

    if (
      operationType === 'move-to-placeholder' &&
      targetPlaceholder?.zoneId &&
      state.draggedItem.sourceZoneId &&
      targetPlaceholder.zoneId === state.draggedItem.sourceZoneId
    ) {
      const zoneName = state.draggedItem.sourceZoneName || targetPlaceholder.zoneName || 'la misma zona'
      toast.warning(
        `${state.draggedItem.coupleName} viene de ${zoneName} y el placeholder ${targetPlaceholder.originalLabel} tambien sale de esa zona.`,
        { duration: 5000 }
      )
    }
    
    // ✅ NUEVO: Log detallado para debug
    console.log(`✅ [handleDrop] Operación creada:`, {
      operationType,
      source: `${state.draggedItem.sourceMatchId}:${state.draggedItem.sourceSlot}`,
      target: `${targetMatch.id}:${targetSlot}`,
      operationId: operation.operationId
    })
    
    if (config.visual.hapticFeedback && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([50, 50, 50])
    }
    
    // Terminar drag
    endDrag()
  }, [state.draggedItem, canDropToSlot, determineOperationType, actions, config, endDrag])
  
  // ============================================================================
  // OPERACIONES BATCH
  // ============================================================================
  
  /**
   * Guarda todas las operaciones pendientes usando el nuevo endpoint mejorado
   */
  const saveAllOperations = useCallback(async (): Promise<BracketSaveResult> => {
    if (state.pendingOperations.length === 0) {
      return {
        success: true,
        processedOperations: 0,
        failedOperations: [],
        errors: [],
        duration: 0
      }
    }
    
    const startTime = performance.now()
    
    toast.loading(`Guardando ${state.pendingOperations.length} operaciones...`)
    
    try {
      // ✅ NUEVO: Usar endpoint mejorado que maneja todos los tipos de operaciones
      const response = await fetch(`/api/tournaments/${tournamentId}/enhanced-bracket-operations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operations: state.pendingOperations.map(operation => ({
            operationId: operation.operationId,
            operationType: operation.operationType,
            sourceItem: {
              sourceMatchId: operation.sourceItem.sourceMatchId,
              sourceSlot: operation.sourceItem.sourceSlot,
              sourceRound: operation.sourceItem.sourceRound,
              coupleId: operation.sourceItem.coupleId,
              coupleName: operation.sourceItem.coupleName
            },
            targetSlot: {
              matchId: operation.targetSlot.matchId,
              slot: operation.targetSlot.slot,
              round: operation.targetSlot.round
            },
            targetCouple: operation.targetCouple,
            targetPlaceholder: operation.targetPlaceholder,
            createdAt: operation.createdAt
          }))
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`HTTP ${response.status}: ${errorData.errors?.[0] || response.statusText}`)
      }
      
      const result = await response.json()
      const duration = performance.now() - startTime
      
      // ✅ NUEVO: Manejo mejorado de resultados por tipo de operación
      if (result.success) {
        actions.clearPendingOperations()
        toast.dismiss()
        
        // Feedback específico por tipos de operación procesadas
        const operationTypes = [...new Set(state.pendingOperations.map(op => op.operationType))]
        const typeLabels = {
          'swap': '🔄 intercambios',
          'move-to-empty': '📍 movimientos a slots vacíos', 
          'move-to-placeholder': '📥 movimientos a placeholders'
        }
        
        const typesList = operationTypes.map(type => typeLabels[type as keyof typeof typeLabels]).join(', ')
        toast.success(`✅ ${result.processedOperations} operaciones completadas: ${typesList}`)
        actions.startAnimation('drop-success', 'bracket-container')
        
      } else {
        toast.dismiss()
        
        if (result.processedOperations > 0) {
          // Parcialmente exitoso
          toast.warning(`⚠️ ${result.processedOperations} operaciones exitosas, ${result.failedOperations} fallaron`)
        } else {
          // Completamente fallido
          toast.error(`❌ Todas las operaciones fallaron. Revisa los errores.`)
        }
        
        actions.startAnimation('drop-error', 'bracket-container')
        
        // Log errores detallados para debug
        console.error('🚨 [saveAllOperations] Operation failures:', {
          failedOperations: result.failedOperations,
          errors: result.errors,
          results: result.results
        })
      }
      
      // ✅ NUEVO: Mapear resultados detallados
      const failedOperations = result.results
        ? result.results
            .filter((r: any) => !r.success)
            .map((r: any) => state.pendingOperations.find(op => op.operationId === r.operationId))
            .filter(Boolean) as BracketSwapOperation[]
        : []
      
      return {
        success: result.success,
        processedOperations: result.processedOperations || 0,
        failedOperations,
        errors: result.errors || [],
        duration
      }
      
    } catch (error) {
      const duration = performance.now() - startTime
      toast.dismiss()
      
      // ✅ MEJORADO: Mejor manejo de errores específicos
      if (error instanceof Error) {
        if (error.message.includes('hierarchy')) {
          toast.error('Error: Inconsistencia en la jerarquía del bracket')
        } else if (error.message.includes('finished')) {
          toast.error('Error: No se pueden modificar matches finalizados')  
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          toast.error('Error: No tienes permisos para realizar esta operación')
        } else {
          toast.error(`Error al guardar operaciones: ${error.message}`)
        }
      } else {
        toast.error('Error general al guardar operaciones')
      }
      
      return {
        success: false,
        processedOperations: 0,
        failedOperations: state.pendingOperations,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration
      }
    }
  }, [state.pendingOperations, tournamentId, actions])
  
  /**
   * Limpia operaciones pendientes
   */
  const clearPendingOperations = useCallback(() => {
    actions.clearPendingOperations()
    toast.success('Operaciones pendientes canceladas')
  }, [actions])
  
  // ============================================================================
  // UTILIDADES
  // ============================================================================
  
  /**
   * Crea un drop target
   */
  const createDropTarget = useCallback((
    match: BracketMatchV2, 
    slot: 'slot1' | 'slot2'
  ): BracketDropTarget => {
    const validation = canDropToSlot(match, slot)
    
    return {
      type: 'bracket-slot',
      matchId: match.id,
      slot,
      round: match.round,
      bracketPosition: match.order_in_round,
      isValid: validation.canDrop,
      invalidReason: validation.reason
    }
  }, [canDropToSlot])
  
  // ============================================================================
  // RETORNO DEL HOOK
  // ============================================================================
  
  return {
    // Estado
    isDragging: state.isDragging,
    draggedItem: state.draggedItem,
    dragOverTarget: state.dragOverTarget,
    
    // Operaciones pendientes
    pendingOperations: state.pendingOperations,
    hasPendingOperations,
    
    // Configuración
    config,
    
    // Acciones de drag
    startDrag,
    endDrag,
    setDragOver,
    
    // Acciones de drop
    handleDrop,
    
    // Validaciones
    canDragCouple,
    canDropToSlot,
    
    // Operaciones batch
    saveAllOperations,
    clearPendingOperations,
    
    // Utilidades
    createDropTarget,
    determineOperationType // ✅ NUEVO
  }
}

export default useBracketDragOperations
