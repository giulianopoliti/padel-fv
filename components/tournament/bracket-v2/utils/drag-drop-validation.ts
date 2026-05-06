/**
 * DRAG & DROP VALIDATION - SISTEMA DE VALIDACIÓN AVANZADA
 * 
 * Utilidades especializadas para validación de operaciones de drag & drop.
 * Incluye reglas customizables, contextos de validación y helpers avanzados.
 * 
 * FUNCIONALIDADES:
 * - Validación en múltiples niveles (datos, lógica, permisos)
 * - Reglas customizables y extensibles
 * - Contextos de validación con metadatos
 * - Rate limiting y anti-spam
 * - Logging detallado para auditoría
 * 
 * @author Claude Code Assistant
 * @version 2.0.0
 * @created 2025-01-17
 */

import type {
  BracketData,
  BracketMatchV2,
  CoupleData,
  ParticipantSlot
} from '../types/bracket-types'
import type {
  DragDropOperation,
  DragDropValidation,
  ValidationRule,
  ValidationContext,
  ValidationResult,
  SlotPosition
} from '../types/drag-drop-types'

// ============================================================================
// REGLAS DE VALIDACIÓN PREDEFINIDAS
// ============================================================================

/**
 * Regla: Solo misma ronda
 */
export const SAME_ROUND_RULE: ValidationRule = {
  id: 'same-round',
  name: 'Misma Ronda',
  validate: (operation: DragDropOperation, context: ValidationContext): boolean => {
    const sourceMatch = context.allMatches.find(m => m.id === operation.sourceMatchId)
    const targetMatch = context.allMatches.find(m => m.id === operation.targetMatchId)
    
    if (!sourceMatch || !targetMatch) return false
    
    return sourceMatch.round === targetMatch.round
  },
  errorMessage: 'Solo se pueden intercambiar parejas dentro de la misma ronda',
  priority: 1,
  enabled: true
}

/**
 * Regla: Matches no en progreso
 */
export const NO_IN_PROGRESS_RULE: ValidationRule = {
  id: 'no-in-progress',
  name: 'Matches No En Progreso',
  validate: (operation: DragDropOperation, context: ValidationContext): boolean => {
    const sourceMatch = context.allMatches.find(m => m.id === operation.sourceMatchId)
    const targetMatch = context.allMatches.find(m => m.id === operation.targetMatchId)
    
    if (!sourceMatch || !targetMatch) return false
    
    return sourceMatch.status === 'PENDING' && targetMatch.status === 'PENDING'
  },
  errorMessage: 'No se pueden mover parejas de matches en progreso o finalizados',
  priority: 1,
  enabled: true
}

/**
 * Regla: Ambas posiciones ocupadas
 */
export const BOTH_OCCUPIED_RULE: ValidationRule = {
  id: 'both-occupied',
  name: 'Ambas Posiciones Ocupadas',
  validate: (operation: DragDropOperation, context: ValidationContext): boolean => {
    const sourceMatch = context.allMatches.find(m => m.id === operation.sourceMatchId)
    const targetMatch = context.allMatches.find(m => m.id === operation.targetMatchId)
    
    if (!sourceMatch || !targetMatch) return false
    
    const sourceSlot = sourceMatch.participants[operation.sourceSlot]
    const targetSlot = targetMatch.participants[operation.targetSlot]
    
    return sourceSlot.type === 'couple' && targetSlot.type === 'couple'
  },
  errorMessage: 'Ambas posiciones deben tener parejas para intercambiar',
  priority: 2,
  enabled: true
}

/**
 * Regla: No mismo slot
 */
export const NOT_SAME_SLOT_RULE: ValidationRule = {
  id: 'not-same-slot',
  name: 'No Mismo Slot',
  validate: (operation: DragDropOperation, context: ValidationContext): boolean => {
    return !(operation.sourceMatchId === operation.targetMatchId && 
             operation.sourceSlot === operation.targetSlot)
  },
  errorMessage: 'No se puede arrastrar al mismo lugar',
  priority: 1,
  enabled: true
}

/**
 * Regla: Permisos de usuario
 */
export const USER_PERMISSION_RULE: ValidationRule = {
  id: 'user-permission',
  name: 'Permisos de Usuario',
  validate: (operation: DragDropOperation, context: ValidationContext): boolean => {
    return context.currentUser.isOwner && 
           context.tournamentConfig.allowDragDrop &&
           context.currentUser.permissions.includes('edit-bracket')
  },
  errorMessage: 'No tienes permisos para realizar intercambios',
  priority: 1,
  enabled: true
}

/**
 * Todas las reglas por defecto
 */
export const DEFAULT_VALIDATION_RULES: ValidationRule[] = [
  SAME_ROUND_RULE,
  NO_IN_PROGRESS_RULE,
  BOTH_OCCUPIED_RULE,
  NOT_SAME_SLOT_RULE,
  USER_PERMISSION_RULE
]

// ============================================================================
// MOTOR DE VALIDACIÓN
// ============================================================================

/**
 * Motor principal de validación
 */
export class DragDropValidator {
  private rules: ValidationRule[]
  private context: ValidationContext
  
  constructor(context: ValidationContext, customRules?: ValidationRule[]) {
    this.context = context
    this.rules = customRules || DEFAULT_VALIDATION_RULES
  }
  
  /**
   * Actualizar contexto de validación
   */
  updateContext(context: Partial<ValidationContext>): void {
    this.context = { ...this.context, ...context }
  }
  
  /**
   * Añadir regla customizada
   */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule)
    this.rules.sort((a, b) => a.priority - b.priority)
  }
  
  /**
   * Remover regla por ID
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(rule => rule.id !== ruleId)
  }
  
  /**
   * Habilitar/deshabilitar regla
   */
  toggleRule(ruleId: string, enabled: boolean): void {
    const rule = this.rules.find(r => r.id === ruleId)
    if (rule) {
      rule.enabled = enabled
    }
  }
  
  /**
   * Validar operación con todas las reglas
   */
  validate(operation: DragDropOperation): DragDropValidation {
    const enabledRules = this.rules.filter(rule => rule.enabled)
    const checks = {
      sameRound: false,
      bothOccupied: false,
      hasPermission: false,
      matchesNotInProgress: false
    }
    
    // Ejecutar todas las reglas
    for (const rule of enabledRules) {
      try {
        const ruleResult = rule.validate(operation, this.context)
        
        // Mapear resultados a checks específicos
        switch (rule.id) {
          case 'same-round':
            checks.sameRound = ruleResult
            break
          case 'both-occupied':
            checks.bothOccupied = ruleResult
            break
          case 'user-permission':
            checks.hasPermission = ruleResult
            break
          case 'no-in-progress':
            checks.matchesNotInProgress = ruleResult
            break
        }
        
        if (!ruleResult) {
          return {
            isValid: false,
            result: this.mapRuleToValidationResult(rule.id),
            message: rule.errorMessage,
            checks,
            metadata: {
              validatedAt: new Date().toISOString(),
              confidence: 1.0
            }
          }
        }
      } catch (error) {
        console.error(`[DragDropValidator] Error in rule ${rule.id}:`, error)
        return {
          isValid: false,
          result: 'missing-couple',
          message: `Error en validación: ${rule.name}`,
          checks,
          metadata: {
            validatedAt: new Date().toISOString(),
            confidence: 0.0
          }
        }
      }
    }
    
    // Si todas las reglas pasaron
    return {
      isValid: true,
      result: 'valid',
      message: 'Intercambio válido',
      checks,
      metadata: {
        validatedAt: new Date().toISOString(),
        confidence: 1.0
      }
    }
  }
  
  /**
   * Mapear ID de regla a ValidationResult
   */
  private mapRuleToValidationResult(ruleId: string): ValidationResult {
    const mapping: Record<string, ValidationResult> = {
      'same-round': 'different-round',
      'no-in-progress': 'match-in-progress',
      'both-occupied': 'missing-couple',
      'not-same-slot': 'same-slot',
      'user-permission': 'no-permission'
    }
    
    return mapping[ruleId] || 'missing-couple'
  }
  
  /**
   * Validar múltiples operaciones en batch
   */
  validateBatch(operations: DragDropOperation[]): DragDropValidation[] {
    return operations.map(operation => this.validate(operation))
  }
  
  /**
   * Pre-validar antes de iniciar drag
   */
  preValidateDrag(
    couple: CoupleData,
    match: BracketMatchV2,
    slot: SlotPosition
  ): { canDrag: boolean; reason?: string } {
    // Verificar permisos básicos
    if (!this.context.currentUser.isOwner) {
      return { canDrag: false, reason: 'No tienes permisos para arrastrar elementos' }
    }
    
    // Verificar que el match no esté en progreso
    if (match.status !== 'PENDING') {
      return { canDrag: false, reason: 'No se pueden mover parejas de matches en progreso' }
    }
    
    // Verificar que hay una pareja en el slot
    const participantSlot = match.participants[slot]
    if (participantSlot.type !== 'couple') {
      return { canDrag: false, reason: 'No hay una pareja en esta posición' }
    }
    
    return { canDrag: true }
  }
}

// ============================================================================
// UTILIDADES DE VALIDACIÓN
// ============================================================================

/**
 * Crear contexto de validación desde bracket data
 */
export function createValidationContext(
  bracketData: BracketData,
  currentUser: {
    id: string
    isOwner: boolean
    permissions: string[]
  },
  tournamentConfig: {
    allowDragDrop: boolean
    restrictionsEnabled: boolean
  }
): ValidationContext {
  return {
    allMatches: bracketData.matches,
    currentUser,
    tournamentConfig
  }
}

/**
 * Validar si un usuario puede realizar drag & drop
 */
export function canUserDragDrop(
  user: { isOwner: boolean; permissions: string[] },
  tournamentConfig: { allowDragDrop: boolean }
): boolean {
  return user.isOwner && 
         tournamentConfig.allowDragDrop && 
         user.permissions.includes('edit-bracket')
}

/**
 * Obtener matches válidos para drop desde un match origen
 */
export function getValidDropMatches(
  sourceMatch: BracketMatchV2,
  allMatches: BracketMatchV2[],
  sourceSlot: SlotPosition
): BracketMatchV2[] {
  return allMatches.filter(match => {
    // Misma ronda
    if (match.round !== sourceMatch.round) return false
    
    // No en progreso
    if (match.status !== 'PENDING') return false
    
    // Tiene al menos un slot con pareja (para poder intercambiar)
    const hasCouple = match.participants.slot1.type === 'couple' || 
                     match.participants.slot2.type === 'couple'
    
    return hasCouple
  })
}

/**
 * Calcular score de compatibilidad entre dos matches para intercambio
 */
export function calculateCompatibilityScore(
  sourceMatch: BracketMatchV2,
  targetMatch: BracketMatchV2,
  sourceSlot: SlotPosition,
  targetSlot: SlotPosition
): number {
  let score = 0
  
  // Misma ronda (+50 puntos)
  if (sourceMatch.round === targetMatch.round) score += 50
  
  // Ambos PENDING (+30 puntos)
  if (sourceMatch.status === 'PENDING' && targetMatch.status === 'PENDING') score += 30
  
  // Ambos slots ocupados (+20 puntos)
  const sourceParticipant = sourceMatch.participants[sourceSlot]
  const targetParticipant = targetMatch.participants[targetSlot]
  if (sourceParticipant.type === 'couple' && targetParticipant.type === 'couple') score += 20
  
  // No es el mismo match (+10 puntos)
  if (sourceMatch.id !== targetMatch.id) score += 10
  
  // Bonus por seeds similares si disponibles
  if (sourceParticipant.seed && targetParticipant.seed) {
    const seedDiff = Math.abs(sourceParticipant.seed.seed - targetParticipant.seed.seed)
    if (seedDiff <= 2) score += 5 // Seeds cercanas
  }
  
  return score
}

/**
 * Rate limiting para operaciones de drag & drop
 */
export class DragDropRateLimiter {
  private operations: Map<string, number[]> = new Map()
  private readonly windowMs: number
  private readonly maxOperations: number
  
  constructor(windowMs = 60000, maxOperations = 10) {
    this.windowMs = windowMs
    this.maxOperations = maxOperations
  }
  
  /**
   * Verificar si usuario puede realizar operación
   */
  canPerformOperation(userId: string): boolean {
    const now = Date.now()
    const userOps = this.operations.get(userId) || []
    
    // Filtrar operaciones dentro de la ventana
    const recentOps = userOps.filter(timestamp => now - timestamp < this.windowMs)
    
    // Actualizar lista
    this.operations.set(userId, recentOps)
    
    return recentOps.length < this.maxOperations
  }
  
  /**
   * Registrar operación
   */
  recordOperation(userId: string): void {
    const now = Date.now()
    const userOps = this.operations.get(userId) || []
    userOps.push(now)
    this.operations.set(userId, userOps)
  }
  
  /**
   * Obtener tiempo restante hasta poder realizar operación
   */
  getTimeUntilNextOperation(userId: string): number {
    const now = Date.now()
    const userOps = this.operations.get(userId) || []
    
    if (userOps.length < this.maxOperations) return 0
    
    const oldestOp = Math.min(...userOps)
    return Math.max(0, this.windowMs - (now - oldestOp))
  }
  
  /**
   * Limpiar operaciones antiguas
   */
  cleanup(): void {
    const now = Date.now()
    
    for (const [userId, operations] of this.operations.entries()) {
      const recentOps = operations.filter(timestamp => now - timestamp < this.windowMs)
      
      if (recentOps.length === 0) {
        this.operations.delete(userId)
      } else {
        this.operations.set(userId, recentOps)
      }
    }
  }
}