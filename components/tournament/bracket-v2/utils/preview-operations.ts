/**
 * PREVIEW OPERATIONS UTILITIES
 * 
 * Funciones para aplicar operaciones pendientes de drag & drop sobre los datos
 * del bracket para mostrar un preview visual antes de guardar.
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 */

import type { BracketData, BracketMatchV2 } from '../types/bracket-types'
import type { BracketSwapOperation } from '../types/bracket-drag-types'

/**
 * Aplica todas las operaciones pendientes sobre una copia de los datos originales
 * para generar un preview de cómo quedaría el bracket tras los intercambios.
 */
export function applyPendingOperationsToData(
  originalData: BracketData,
  pendingOperations: BracketSwapOperation[]
): BracketData {
  if (!pendingOperations || pendingOperations.length === 0) {
    console.log(`📋 [preview-operations] No hay operaciones pendientes, devolviendo datos originales`)
    return originalData
  }

  console.log(`🔄 [preview-operations] Aplicando ${pendingOperations.length} operaciones pendientes:`, pendingOperations)

  // Crear una copia profunda de los datos originales (MEJORADA)
  const previewData: BracketData = {
    ...originalData,
    matches: originalData.matches.map(match => ({
      ...match,
      // CRÍTICO: Copia profunda de participants
      participants: match.participants ? {
        slot1: match.participants.slot1 ? {
          ...match.participants.slot1,
          couple: match.participants.slot1.couple ? { ...match.participants.slot1.couple } : null
        } : null,
        slot2: match.participants.slot2 ? {
          ...match.participants.slot2,
          couple: match.participants.slot2.couple ? { ...match.participants.slot2.couple } : null
        } : null
      } : null
    }))
  }

  console.log(`📦 [preview-operations] Datos copiados, aplicando operaciones...`)

  // Aplicar cada operación pendiente sobre la copia
  for (const operation of pendingOperations) {
    console.log(`⚡ [preview-operations] Aplicando operación:`, {
      operationId: operation.operationId,
      source: `${operation.sourceItem.sourceMatchId}:${operation.sourceItem.sourceSlot}`,
      target: `${operation.targetSlot.matchId}:${operation.targetSlot.slot}`
    })
    applyOperationToMatches(previewData.matches, operation)
  }

  console.log(`✅ [preview-operations] Preview data generado con ${previewData.matches.length} matches`)
  return previewData
}

/**
 * Aplica una operación individual sobre los matches
 */
function applyOperationToMatches(
  matches: BracketMatchV2[], 
  operation: BracketSwapOperation
): void {
  const sourceMatch = matches.find(m => m.id === operation.sourceItem.sourceMatchId)
  const targetMatch = matches.find(m => m.id === operation.targetSlot.matchId)

  if (!sourceMatch || !targetMatch) {
    console.warn('❌ [applyOperationToMatches] Match not found for operation:', operation)
    return
  }

  console.log(`🔄 [applyOperationToMatches] Intercambiando:`, {
    operation: operation.operationId,
    sourceMatch: sourceMatch.id,
    targetMatch: targetMatch.id,
    sourceSlot: operation.sourceItem.sourceSlot,
    targetSlot: operation.targetSlot.slot
  })

  // Determinar los slots a intercambiar
  const sourceSlotKey = operation.sourceItem.sourceSlot === 'slot1' ? 'couple1_id' : 'couple2_id'
  const targetSlotKey = operation.targetSlot.slot === 'slot1' ? 'couple1_id' : 'couple2_id'
  const sourceParticipantSlot = operation.sourceItem.sourceSlot === 'slot1' ? 'slot1' : 'slot2'
  const targetParticipantSlot = operation.targetSlot.slot === 'slot1' ? 'slot1' : 'slot2'

  // Obtener los IDs originales
  const sourceCoupleId = sourceMatch[sourceSlotKey]
  const targetCoupleId = targetMatch[targetSlotKey]

  console.log(`📊 [applyOperationToMatches] ANTES del intercambio:`, {
    sourceMatch: {
      id: sourceMatch.id,
      [sourceSlotKey]: sourceCoupleId,
      participant: sourceMatch.participants?.[sourceParticipantSlot]?.couple?.id
    },
    targetMatch: {
      id: targetMatch.id,
      [targetSlotKey]: targetCoupleId,
      participant: targetMatch.participants?.[targetParticipantSlot]?.couple?.id
    }
  })

  // INTERCAMBIO COMPLETO: IDs
  sourceMatch[sourceSlotKey] = targetCoupleId
  targetMatch[targetSlotKey] = sourceCoupleId

  // INTERCAMBIO COMPLETO: Objetos en participants (CRÍTICO para el renderizado)
  if (sourceMatch.participants && targetMatch.participants) {
    // Obtener objetos completos de participantes
    const sourceParticipant = sourceMatch.participants[sourceParticipantSlot]
    const targetParticipant = targetMatch.participants[targetParticipantSlot]
    
    // Intercambiar OBJETOS COMPLETOS (con toda la información)
    sourceMatch.participants[sourceParticipantSlot] = targetParticipant ? {
      ...targetParticipant,
      // Preservar toda la información del participante
      couple: targetParticipant.couple ? {
        ...targetParticipant.couple,
        // Asegurar que el ID sea consistente
        id: targetCoupleId
      } : null
    } : null
    
    targetMatch.participants[targetParticipantSlot] = sourceParticipant ? {
      ...sourceParticipant,
      couple: sourceParticipant.couple ? {
        ...sourceParticipant.couple,
        id: sourceCoupleId
      } : null
    } : null
  }

  // Si no hay participants, crear estructura básica para el renderizado
  if (!sourceMatch.participants) {
    sourceMatch.participants = { slot1: null, slot2: null }
  }
  if (!targetMatch.participants) {
    targetMatch.participants = { slot1: null, slot2: null }
  }

  console.log(`✅ [applyOperationToMatches] DESPUÉS del intercambio:`, {
    sourceMatch: {
      id: sourceMatch.id,
      [sourceSlotKey]: sourceMatch[sourceSlotKey],
      participant: sourceMatch.participants?.[sourceParticipantSlot]?.couple?.id
    },
    targetMatch: {
      id: targetMatch.id,
      [targetSlotKey]: targetMatch[targetSlotKey],
      participant: targetMatch.participants?.[targetParticipantSlot]?.couple?.id
    }
  })
}

/**
 * Verifica si un match específico tiene cambios pendientes
 */
export function hasMatchPendingChanges(
  matchId: string,
  pendingOperations: BracketSwapOperation[]
): boolean {
  return pendingOperations.some(op => 
    op.sourceItem.sourceMatchId === matchId || 
    op.targetSlot.matchId === matchId
  )
}

/**
 * Obtiene las operaciones pendientes que afectan a un match específico
 */
export function getMatchPendingOperations(
  matchId: string,
  pendingOperations: BracketSwapOperation[]
): BracketSwapOperation[] {
  return pendingOperations.filter(op => 
    op.sourceItem.sourceMatchId === matchId || 
    op.targetSlot.matchId === matchId
  )
}

/**
 * Verifica si una pareja específica en un match tiene cambios pendientes
 */
export function hasCoupleSlotPendingChanges(
  matchId: string,
  slot: 'slot1' | 'slot2',
  pendingOperations: BracketSwapOperation[]
): boolean {
  return pendingOperations.some(op => 
    (op.sourceItem.sourceMatchId === matchId && op.sourceItem.sourceSlot === slot) ||
    (op.targetSlot.matchId === matchId && op.targetSlot.slot === slot)
  )
}

/**
 * Obtiene información de preview para un match específico
 */
export function getMatchPreviewInfo(
  matchId: string,
  pendingOperations: BracketSwapOperation[]
) {
  const operations = getMatchPendingOperations(matchId, pendingOperations)
  
  return {
    hasChanges: operations.length > 0,
    operationsCount: operations.length,
    operations,
    affectedSlots: {
      slot1: hasCoupleSlotPendingChanges(matchId, 'slot1', pendingOperations),
      slot2: hasCoupleSlotPendingChanges(matchId, 'slot2', pendingOperations)
    }
  }
}