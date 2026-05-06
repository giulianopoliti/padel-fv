/**
 * DRAG & DROP TYPES - SISTEMA DE INTERCAMBIO DE POSICIONES
 * 
 * Tipos específicos para el sistema de drag & drop que permite intercambiar
 * posiciones de parejas dentro de la misma ronda del bracket.
 * 
 * REGLAS DEL SISTEMA:
 * - Solo intercambio dentro de la misma ronda
 * - Solo entre parejas reales (no placeholders)
 * - Solo usuarios propietarios pueden realizar cambios
 * - Validación en tiempo real
 * 
 * @author Claude Code Assistant
 * @version 2.0.0
 * @created 2025-01-17
 */

import type { 
  BracketMatchV2, 
  CoupleData, 
  Round 
} from './bracket-types'

// ============================================================================
// TIPOS BASE DE DRAG & DROP
// ============================================================================

/**
 * Posición de slot en un match
 */
export type SlotPosition = 'slot1' | 'slot2'

/**
 * Estados posibles durante el drag & drop
 */
export type DragDropState = 
  | 'idle'        // Sin actividad de drag
  | 'dragging'    // Arrastrando un elemento
  | 'dropping'    // Soltando en un target válido
  | 'processing'  // Procesando la operación en backend
  | 'error'       // Error en la operación

/**
 * Tipos de validación de drop
 */
export type ValidationResult = 
  | 'valid'           // Drop válido
  | 'same-round'      // Misma ronda pero hay otros problemas
  | 'different-round' // Diferentes rondas (no permitido)
  | 'missing-couple'  // Falta pareja en source o target
  | 'same-slot'       // Intentando soltar en el mismo slot
  | 'no-permission'   // Usuario sin permisos
  | 'match-in-progress' // Match ya en curso

// ============================================================================
// ELEMENTOS DE DRAG
// ============================================================================

/**
 * Datos de la pareja que se está arrastrando
 */
export interface DraggedCouple {
  /** Datos de la pareja */
  couple: CoupleData
  /** Match de origen */
  sourceMatch: BracketMatchV2
  /** Slot de origen */
  sourceSlot: SlotPosition
  /** Metadatos del drag */
  metadata: {
    /** Timestamp de inicio del drag */
    startedAt: string
    /** Posición inicial del mouse */
    startPosition: { x: number, y: number }
    /** Round de origen (para validación rápida) */
    sourceRound: Round
  }
}

/**
 * Target donde se puede soltar
 */
export interface DropTarget {
  /** Match de destino */
  match: BracketMatchV2
  /** Slot de destino */
  slot: SlotPosition
  /** Si es un target válido */
  isValid: boolean
  /** Razón si no es válido */
  invalidReason?: string
  /** Distancia al elemento arrastrado */
  distance?: number
}

/**
 * Zona de drop visual
 */
export interface DropZone {
  /** ID único de la zona */
  id: string
  /** Match al que pertenece */
  match: BracketMatchV2
  /** Slot específico */
  slot: SlotPosition
  /** Posición visual */
  position: {
    x: number
    y: number
    width: number
    height: number
  }
  /** Si está activa */
  isActive: boolean
  /** Si es un target válido para el drag actual */
  isValid: boolean
  /** Clase CSS para styling */
  cssClass: string
}

// ============================================================================
// OPERACIONES DE DRAG & DROP
// ============================================================================

/**
 * Operación completa de intercambio
 */
export interface DragDropOperation {
  /** ID único de la operación */
  operationId: string
  /** Match de origen */
  sourceMatchId: string
  /** Match de destino */
  targetMatchId: string
  /** Slot de origen */
  sourceSlot: SlotPosition
  /** Slot de destino */
  targetSlot: SlotPosition
  /** Resultado de validación */
  validation: DragDropValidation
  /** Timestamp de la operación */
  timestamp: string
  /** Metadatos adicionales */
  metadata?: {
    /** Usuario que realizó la operación */
    userId?: string
    /** Razón del intercambio */
    reason?: string
  }
}

/**
 * Resultado de validación de una operación
 */
export interface DragDropValidation {
  /** Si la operación es válida */
  isValid: boolean
  /** Resultado específico */
  result: ValidationResult
  /** Mensaje explicativo */
  message?: string
  /** Validaciones específicas */
  checks: {
    /** Ambos en la misma ronda */
    sameRound: boolean
    /** Ambas posiciones ocupadas */
    bothOccupied: boolean
    /** Usuario tiene permisos */
    hasPermission: boolean
    /** Matches no están en progreso */
    matchesNotInProgress: boolean
  }
  /** Metadatos de validación */
  metadata?: {
    /** Timestamp de validación */
    validatedAt: string
    /** Nivel de confianza (0-1) */
    confidence: number
  }
}

// ============================================================================
// RESULTADOS DE OPERACIONES
// ============================================================================

/**
 * Resultado de una operación de intercambio
 */
export interface SwapOperationResult {
  /** Si la operación fue exitosa */
  success: boolean
  /** ID de la operación */
  operationId: string
  /** Datos actualizados (si success = true) */
  updatedData?: {
    /** Match de origen actualizado */
    sourceMatch: BracketMatchV2
    /** Match de destino actualizado */
    targetMatch: BracketMatchV2
  }
  /** Error (si success = false) */
  error?: {
    /** Código de error */
    code: string
    /** Mensaje de error */
    message: string
    /** Detalles técnicos */
    details?: any
  }
  /** Metadatos de la operación */
  metadata: {
    /** Duración de la operación en ms */
    duration: number
    /** Timestamp de finalización */
    completedAt: string
    /** Si se aplicó rollback */
    rollbackApplied?: boolean
  }
}

/**
 * Estado de múltiples operaciones (para tracking)
 */
export interface DragDropOperationState {
  /** Operaciones en progreso */
  inProgress: DragDropOperation[]
  /** Operaciones completadas (últimas 10) */
  completed: SwapOperationResult[]
  /** Operaciones con error */
  failed: SwapOperationResult[]
  /** Estadísticas */
  stats: {
    /** Total de operaciones realizadas */
    totalOperations: number
    /** Tasa de éxito */
    successRate: number
    /** Tiempo promedio de operación */
    averageDuration: number
  }
}

// ============================================================================
// CONFIGURACIÓN Y COMPORTAMIENTO
// ============================================================================

/**
 * Configuración del sistema de drag & drop
 */
export interface DragDropConfig {
  /** Si está habilitado */
  enabled: boolean
  /** Solo para propietarios */
  ownerOnly: boolean
  /** Configuración visual */
  visual: {
    /** Mostrar zonas de drop */
    showDropZones: boolean
    /** Animaciones habilitadas */
    animations: boolean
    /** Feedback háptico */
    hapticFeedback: boolean
    /** Tema visual */
    theme: 'default' | 'minimal' | 'sport'
  }
  /** Configuración de validación */
  validation: {
    /** Validación en tiempo real */
    realTimeValidation: boolean
    /** Tiempo máximo de validación en ms */
    validationTimeout: number
    /** Re-validar antes de enviar */
    revalidateBeforeSubmit: boolean
  }
  /** Configuración de performance */
  performance: {
    /** Debounce para validaciones en ms */
    validationDebounce: number
    /** Caché de validaciones */
    cacheValidations: boolean
    /** Límite de operaciones concurrentes */
    maxConcurrentOps: number
  }
}

// ============================================================================
// HOOKS Y CONTEXTO
// ============================================================================

/**
 * Estado del hook useBracketDragDrop
 */
export interface BracketDragDropState {
  /** Estado actual */
  state: DragDropState
  /** Elemento siendo arrastrado */
  draggedItem: DraggedCouple | null
  /** Zonas de drop disponibles */
  dropZones: DropZone[]
  /** Target actual del hover */
  currentTarget: DropTarget | null
  /** Operaciones en progreso */
  operations: DragDropOperationState
  /** Configuración */
  config: DragDropConfig
}

/**
 * Acciones disponibles en el hook
 */
export interface BracketDragDropActions {
  /** Iniciar drag */
  startDrag: (couple: CoupleData, match: BracketMatchV2, slot: SlotPosition) => void
  /** Finalizar drag */
  endDrag: () => void
  /** Actualizar target de hover */
  setHoverTarget: (target: DropTarget | null) => void
  /** Realizar drop */
  handleDrop: (target: DropTarget) => Promise<SwapOperationResult>
  /** Validar operación */
  validateOperation: (operation: Partial<DragDropOperation>) => DragDropValidation
  /** Cancelar operación */
  cancelOperation: (operationId: string) => void
}

// ============================================================================
// EVENTOS Y CALLBACKS
// ============================================================================

/**
 * Evento de drag & drop
 */
export interface DragDropEvent {
  /** Tipo de evento */
  type: 'drag-start' | 'drag-end' | 'drop' | 'validation' | 'error'
  /** Timestamp del evento */
  timestamp: string
  /** Datos del evento */
  data: {
    /** Operación relacionada */
    operation?: DragDropOperation
    /** Resultado (para eventos de finalización) */
    result?: SwapOperationResult
    /** Error (para eventos de error) */
    error?: any
  }
}

/**
 * Callback para eventos de drag & drop
 */
export type DragDropEventCallback = (event: DragDropEvent) => void

/**
 * Suscripción a eventos
 */
export interface DragDropEventSubscription {
  /** ID de la suscripción */
  id: string
  /** Tipos de eventos de interés */
  eventTypes: DragDropEvent['type'][]
  /** Callback */
  callback: DragDropEventCallback
  /** Si debe incluir eventos internos */
  includeInternalEvents: boolean
}

// ============================================================================
// UTILIDADES DE VALIDACIÓN
// ============================================================================

/**
 * Contexto para validación
 */
export interface ValidationContext {
  /** Todos los matches disponibles */
  allMatches: BracketMatchV2[]
  /** Usuario actual */
  currentUser: {
    id: string
    isOwner: boolean
    permissions: string[]
  }
  /** Configuración del torneo */
  tournamentConfig: {
    allowDragDrop: boolean
    restrictionsEnabled: boolean
  }
}

/**
 * Regla de validación customizable
 */
export interface ValidationRule {
  /** ID único de la regla */
  id: string
  /** Nombre descriptivo */
  name: string
  /** Función de validación */
  validate: (operation: DragDropOperation, context: ValidationContext) => boolean
  /** Mensaje de error si falla */
  errorMessage: string
  /** Prioridad (1 = alta, 10 = baja) */
  priority: number
  /** Si está habilitada */
  enabled: boolean
}

// ============================================================================
// ANIMACIONES Y FEEDBACK VISUAL
// ============================================================================

/**
 * Configuración de animaciones
 */
export interface DragDropAnimations {
  /** Duración de animaciones en ms */
  duration: {
    /** Inicio de drag */
    dragStart: number
    /** Drop exitoso */
    dropSuccess: number
    /** Drop fallido */
    dropFailed: number
    /** Return to original */
    returnToOriginal: number
  }
  /** Easing functions */
  easing: {
    /** Para movimientos */
    movement: string
    /** Para fades */
    fade: string
    /** Para escalado */
    scale: string
  }
  /** Efectos especiales */
  effects: {
    /** Glow en drop zones */
    glowOnHover: boolean
    /** Shake en error */
    shakeOnError: boolean
    /** Pulse en válido */
    pulseOnValid: boolean
  }
}