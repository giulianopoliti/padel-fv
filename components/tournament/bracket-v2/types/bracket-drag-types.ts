/**
 * Bracket Drag and Drop Types
 * 
 * Tipos para drag & drop de parejas en brackets.
 * Adaptado del sistema exitoso de zonas.
 * 
 * @author Claude Code Assistant
 * @version 1.0.0 
 * @created 2025-01-18
 */

// ============================================================================
// TIPOS BASE
// ============================================================================

/**
 * Item que está siendo arrastrado (siempre una pareja en posición de bracket)
 */
export interface BracketDragItem {
  /** Tipo de elemento */
  type: 'bracket-couple'
  /** ID de la pareja */
  coupleId: string
  /** Nombre de la pareja para display */
  coupleName: string
  /** Match origen */
  sourceMatchId: string
  /** Slot origen (slot1 o slot2) */
  sourceSlot: 'slot1' | 'slot2'
  /** Round origen (para validaciones) */
  sourceRound: string
  /** Posición del bracket origen */
  sourceBracketPosition: number
}

/**
 * Target donde se puede soltar
 */
export interface BracketDropTarget {
  /** Tipo de target */
  type: 'bracket-slot'
  /** ID del match destino */
  matchId: string
  /** Slot destino */
  slot: 'slot1' | 'slot2'
  /** Round destino */
  round: string
  /** Posición del bracket destino */
  bracketPosition: number
  /** Si es válido para drop */
  isValid: boolean
  /** Razón si no es válido */
  invalidReason?: string
}

// ============================================================================
// OPERACIONES DE DRAG & DROP
// ============================================================================

/**
 * Tipos específicos de operaciones según el destino
 */
export type BracketOperationType = 
  | 'swap' // Mover pareja → slot ocupado por otra pareja (intercambio)
  | 'move-to-empty' // Mover pareja → slot con TBD (vacío, esperando a alguien)  
  | 'move-to-placeholder' // Mover pareja → placeholder (ej. "Ganador Partido X")

/**
 * Operación de intercambio entre dos posiciones del bracket
 */
export interface BracketSwapOperation {
  /** Tipo de operación */
  type: 'bracket-swap'
  /** ID único de la operación */
  operationId: string
  /** Subtipo específico según el destino */
  operationType: BracketOperationType
  /** Item origen */
  sourceItem: BracketDragItem
  /** Target destino */
  targetSlot: BracketDropTarget
  /** Pareja que estaba en el target (puede ser null) */
  targetCouple?: {
    coupleId: string
    coupleName: string
  } | null
  /** Información del placeholder si aplica */
  targetPlaceholder?: {
    originalLabel: string
    sourceMatchId?: string
  } | null
  /** Timestamp de creación */
  createdAt: string
}

// ============================================================================
// ESTADOS
// ============================================================================

/**
 * Estado del drag & drop
 */
export interface BracketDragState {
  /** Si está arrastrando */
  isDragging: boolean
  /** Item siendo arrastrado */
  draggedItem: BracketDragItem | null
  /** Target sobre el que está hover */
  dragOverTarget: BracketDropTarget | null
}

/**
 * Estado de animaciones
 */
export interface BracketAnimationState {
  /** Si está animando */
  isAnimating: boolean
  /** Tipo de animación */
  animationType: 'drag-start' | 'drag-end' | 'drop-success' | 'drop-error' | null
  /** Elemento target para animación */
  targetElement: string | null
}

/**
 * Estado extendido incluyendo operaciones pendientes
 */
export interface ExtendedBracketDragState extends BracketDragState {
  /** Animaciones */
  animation: BracketAnimationState
  /** Operaciones pendientes de guardado */
  pendingOperations: BracketSwapOperation[]
}

// ============================================================================
// ACCIONES DEL REDUCER
// ============================================================================

export type BracketDragAction = 
  | { type: 'START_DRAG'; payload: { item: BracketDragItem } }
  | { type: 'END_DRAG' }
  | { type: 'SET_DRAG_OVER'; payload: { target: BracketDropTarget | null } }
  | { type: 'START_ANIMATION'; payload: { type: BracketAnimationState['animationType']; target: string } }
  | { type: 'END_ANIMATION' }
  | { type: 'ADD_PENDING_OPERATION'; payload: { operation: BracketSwapOperation } }
  | { type: 'CLEAR_PENDING_OPERATIONS' }
  | { type: 'RESET' }

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

/**
 * Configuración del sistema de drag & drop
 */
export interface BracketDragDropConfig {
  /** Si está habilitado */
  enabled: boolean
  /** Solo owners pueden hacer drag & drop */
  ownerOnly: boolean
  /** Solo permite intercambios en la misma ronda */
  sameRoundOnly: boolean
  /** Solo permite intercambios en matches PENDING */
  pendingMatchesOnly: boolean
  /** Máximo número de operaciones pendientes */
  maxPendingOperations: number
  /** Timeout para auto-guardar (0 = deshabilitado) */
  autoSaveTimeout: number
  /** Configuración visual */
  visual: {
    /** Mostrar indicadores de drop zones */
    showDropZones: boolean
    /** Animaciones suaves */
    enableAnimations: boolean
    /** Feedback haptico en móviles */
    hapticFeedback: boolean
  }
}

// ============================================================================
// RESULTADO DE OPERACIONES
// ============================================================================

/**
 * Resultado de guardar operaciones
 */
export interface BracketSaveResult {
  /** Si fue exitoso */
  success: boolean
  /** Operaciones procesadas exitosamente */
  processedOperations: number
  /** Operaciones que fallaron */
  failedOperations: BracketSwapOperation[]
  /** Errores detallados */
  errors: string[]
  /** Tiempo total de procesamiento */
  duration: number
}