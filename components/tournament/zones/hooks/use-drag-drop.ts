/**
 * Drag and Drop Hook (Enhanced with Tournament Validation)
 * 
 * Provides utilities for drag and drop operations with rich animations.
 * Handles all drag logic including validation and operation creation.
 * Now integrated with tournament-specific validation rules.
 */

import { useCallback } from 'react'
import { useDragDrop } from '../context/drag-drop-context'
import { useTournamentValidation } from '@/hooks/use-tournament-validation'
import type { 
  DragItem, 
  DropTarget, 
  DragOperation,
  ZoneCoupleItem,
  AvailableCoupleItem 
} from '../types/drag-types'
import type { ZoneValidationResult } from '@/types/tournament-rules.types'

// Enhanced validation rules that extend tournament rules
interface DragDropValidationRules {
  allowSwapping: boolean
  allowDeletion: boolean
  restrictedCouples?: Set<string>
  tournamentId?: string
  formatId?: string
}

const DEFAULT_VALIDATION: DragDropValidationRules = {
  allowSwapping: true,
  allowDeletion: true,
  restrictedCouples: new Set(),
  formatId: 'AMERICAN_2'
}

/**
 * Main drag and drop hook (Enhanced)
 */
export function useDragDropOperations(validation: Partial<DragDropValidationRules> = {}) {
  const { state, actions } = useDragDrop()
  const rules = { ...DEFAULT_VALIDATION, ...validation }
  
  // Get tournament validation system
  const tournamentValidation = useTournamentValidation({
    tournamentId: rules.tournamentId,
    formatId: rules.formatId
  })
  
  // Create drag item for zone couple
  const createZoneCoupleItem = useCallback((
    coupleId: string,
    coupleName: string,
    sourceZoneId: string
  ): ZoneCoupleItem => ({
    type: 'zone-couple',
    coupleId,
    coupleName,
    sourceZoneId
  }), [])
  
  // Create drag item for available couple
  const createAvailableCoupleItem = useCallback((
    coupleId: string,
    coupleName: string
  ): AvailableCoupleItem => ({
    type: 'available-couple',
    coupleId,
    coupleName
  }), [])
  
  // Create drop target
  const createDropTarget = useCallback((
    type: DropTarget['type'],
    id: string,
    name: string
  ): DropTarget => ({
    type,
    id,
    name
  }), [])
  
  // Enhanced validation using tournament rules
  const validateDrop = useCallback((
    dragItem: DragItem,
    dropTarget: DropTarget,
    currentZoneCounts: Record<string, number> = {}
  ): { 
    valid: boolean; 
    reason?: string;
    level?: 'info' | 'warning' | 'error';
    requiresConfirmation?: boolean;
    consequences?: any;
  } => {
    // Check if couple is restricted (has active matches)
    if (rules.restrictedCouples?.has(dragItem.coupleId)) {
      return { 
        valid: false, 
        reason: 'Esta pareja tiene partidos activos y no puede ser movida',
        level: 'error'
      }
    }
    
    // Can't drop on same source
    if (dragItem.type === 'zone-couple' && dropTarget.type === 'zone' && 
        dragItem.sourceZoneId === dropTarget.id) {
      return { 
        valid: false, 
        reason: 'No se puede mover a la misma zona',
        level: 'info'
      }
    }
    
    // Use tournament-specific validation for zones
    if (dropTarget.type === 'zone') {
      const currentCount = currentZoneCounts[dropTarget.id] || 0
      
      // DEBUG: Log validation details
      console.log(`[drag-drop] Validating drop to zone ${dropTarget.id}:`, {
        dragType: dragItem.type === 'zone-couple' ? 'zone-couple' : 'couple',
        currentCount,
        hasPlayedMatches: rules.restrictedCouples?.has(dragItem.coupleId),
        allZoneCounts: currentZoneCounts
      })
      
      const tournamentValidationResult = tournamentValidation.validateDragDrop(
        dragItem.type === 'zone-couple' ? 'zone-couple' : 'couple',
        currentCount,
        {
          hasPlayedMatches: rules.restrictedCouples?.has(dragItem.coupleId),
          isSwapping: false
        }
      )
      
      console.log(`[drag-drop] Validation result:`, tournamentValidationResult)
      
      return {
        valid: tournamentValidationResult.allowed,
        reason: tournamentValidationResult.message,
        level: tournamentValidationResult.level,
        requiresConfirmation: tournamentValidationResult.requiresConfirmation,
        consequences: tournamentValidationResult.consequences
      }
    }
    
    // Check deletion permission
    if (dropTarget.type === 'trash' && !rules.allowDeletion) {
      return { 
        valid: false, 
        reason: 'Eliminación no permitida',
        level: 'error'
      }
    }
    
    return { valid: true }
  }, [rules, tournamentValidation])
  
  // Create drag operation from drop
  const createOperation = useCallback((
    dragItem: DragItem,
    dropTarget: DropTarget
  ): DragOperation | null => {
    if (dropTarget.type === 'zone') {
      return {
        type: 'move-to-zone',
        sourceItem: dragItem,
        targetZoneId: dropTarget.id
      }
    }
    
    if (dropTarget.type === 'available-pool') {
      return {
        type: 'move-to-available',
        sourceItem: dragItem
      }
    }
    
    if (dropTarget.type === 'trash') {
      return {
        type: 'delete',
        sourceItem: dragItem
      }
    }
    
    return null
  }, [])
  
  // Start drag with animation
  const startDragWithAnimation = useCallback((dragItem: DragItem) => {
    actions.startDrag(dragItem)
    actions.startAnimation('drag-start', dragItem.coupleId)
    
    // End start animation after brief delay
    setTimeout(() => {
      actions.endAnimation()
    }, 200)
  }, [actions])
  
  // Handle drop with validation
  const handleDrop = useCallback((
    dropTarget: DropTarget,
    currentZoneCounts: Record<string, number> = {},
    onOperation?: (operation: DragOperation) => void
  ): { success: boolean; message?: string } => {
    const { draggedItem } = state
    
    if (!draggedItem) {
      return { success: false, message: 'No hay elemento siendo arrastrado' }
    }
    
    // Validate drop
    const validation = validateDrop(draggedItem, dropTarget, currentZoneCounts)
    if (!validation.valid) {
      // Show error animation
      actions.startAnimation('drop-error', draggedItem.coupleId)
      setTimeout(() => actions.endAnimation(), 500)
      
      return { success: false, message: validation.reason }
    }
    
    // Create operation
    const operation = createOperation(draggedItem, dropTarget)
    if (!operation) {
      return { success: false, message: 'Operación inválida' }
    }
    
    // Show success animation
    actions.startAnimation('drop-success', draggedItem.coupleId)
    setTimeout(() => actions.endAnimation(), 300)
    
    // Add to pending operations
    actions.addPendingOperation(operation)
    
    // Execute operation callback
    if (onOperation) {
      onOperation(operation)
    }
    
    return { success: true }
  }, [state, actions, validateDrop, createOperation])
  
  // Get visual feedback for drag over
  // Enhanced feedback with validation levels and consequences
  const getDragOverFeedback = useCallback((
    targetId: string,
    currentZoneCounts: Record<string, number> = {}
  ) => {
    const { draggedItem, dragOverTarget } = state
    
    if (!draggedItem || !dragOverTarget || dragOverTarget.id !== targetId) {
      return { 
        isOver: false, 
        canDrop: false, 
        feedback: '',
        level: 'info' as const,
        consequences: null
      }
    }
    
    const validation = validateDrop(draggedItem, dragOverTarget, currentZoneCounts)
    
    return {
      isOver: true,
      canDrop: validation.valid,
      feedback: validation.reason || '',
      level: validation.level || 'info',
      requiresConfirmation: validation.requiresConfirmation,
      consequences: validation.consequences
    }
  }, [state, validateDrop])
  
  // Get animation classes for element
  const getAnimationClasses = useCallback((elementId: string): string => {
    const { animation } = state
    
    if (!animation.isAnimating || animation.targetElement !== elementId) {
      return ''
    }
    
    switch (animation.animationType) {
      case 'drag-start':
        return 'animate-pulse scale-105 transition-all duration-200'
      case 'drag-end':
        return 'transition-all duration-300 ease-out'
      case 'drop-success':
        return 'animate-bounce scale-110 transition-all duration-300'
      case 'drop-error':
        return 'animate-shake scale-95 text-red-500 transition-all duration-500'
      default:
        return ''
    }
  }, [state])
  
  // Check if couple can be dragged (not restricted)
  const canDragCouple = useCallback((coupleId: string): boolean => {
    return !rules.restrictedCouples?.has(coupleId)
  }, [rules])
  
  // Get restriction reason for couple
  const getCoupleRestrictionReason = useCallback((coupleId: string): string | null => {
    if (rules.restrictedCouples?.has(coupleId)) {
      return 'Esta pareja tiene partidos activos y no puede ser movida'
    }
    return null
  }, [rules])
  
  return {
    // State
    isDragging: state.isDragging,
    draggedItem: state.draggedItem,
    dragOverTarget: state.dragOverTarget,
    isAnimating: state.animation.isAnimating,
    pendingOperations: state.pendingOperations,

    // Actions
    startDrag: startDragWithAnimation,
    endDrag: actions.endDrag,
    setDragOver: actions.setDragOver,
    handleDrop,
    reset: actions.reset,
    clearPendingOperations: actions.clearPendingOperations,

    // Utilities
    createZoneCoupleItem,
    createAvailableCoupleItem,
    createDropTarget,
    validateDrop,
    getDragOverFeedback,
    getAnimationClasses,
    canDragCouple,
    getCoupleRestrictionReason,

    // Mobile-specific helpers (for Bottom Sheet)
    createOperation,
    addPendingOperation: actions.addPendingOperation,

    // Tournament validation access
    tournamentRules: tournamentValidation.rules,
    getZoneStatusDescription: tournamentValidation.getZoneStatusDescription,
    calculateConsequences: tournamentValidation.calculateConsequences,
    isZoneDefault: tournamentValidation.isZoneDefault,
    isZoneOverflow: tournamentValidation.isZoneOverflow,
    maxCapacity: tournamentValidation.getMaxCapacity(),
    defaultCapacity: tournamentValidation.getDefaultCapacity()
  }
}