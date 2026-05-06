/**
 * Debug helpers for tournament zones
 * 
 * Utilities to help debug name transformation and data flow issues
 */

export function debugCoupleData(couple: any, context: string) {
  if (process.env.NODE_ENV === 'development') {
    console.group(`[DEBUG] Couple data - ${context}`)
    console.log('Raw couple:', couple)
    console.log('Player1:', couple.player1 || couple.player1_name)
    console.log('Player2:', couple.player2 || couple.player2_name)
    console.log('Metadata:', couple.metadata)
    console.log('Original data:', couple.originalData)
    console.groupEnd()
  }
}

export function debugDragOperation(operation: any, context: string) {
  if (process.env.NODE_ENV === 'development') {
    console.group(`[DEBUG] Drag operation - ${context}`)
    console.log('Operation type:', operation.type)
    console.log('Source item:', operation.sourceItem)
    console.log('Target zone:', operation.targetZoneId)
    console.groupEnd()
  }
}

export function debugOptimisticUpdate(before: any, after: any, context: string) {
  if (process.env.NODE_ENV === 'development') {
    console.group(`[DEBUG] Optimistic update - ${context}`)
    console.log('Before zones:', before.zones?.length)
    console.log('After zones:', after.zones?.length)
    console.log('Before available:', before.availableCouples?.length)
    console.log('After available:', after.availableCouples?.length)
    console.groupEnd()
  }
}