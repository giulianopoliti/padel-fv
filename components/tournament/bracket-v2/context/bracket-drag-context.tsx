/**
 * Bracket Drag and Drop Context Provider
 * 
 * Context para manejar drag & drop de parejas en brackets.
 * Adaptado del sistema exitoso de TournamentZonesMatrix.
 * 
 * @author Claude Code Assistant  
 * @version 1.0.0
 * @created 2025-01-18
 */

'use client'

import React, { createContext, useContext, useReducer, useCallback } from 'react'
import type {
  ExtendedBracketDragState,
  BracketDragItem,
  BracketDropTarget,
  BracketSwapOperation,
  BracketAnimationState,
  BracketDragAction
} from '../types/bracket-drag-types'

// ============================================================================
// CONTEXT INTERFACE
// ============================================================================

interface BracketDragDropContextValue {
  /** Estado actual */
  state: ExtendedBracketDragState
  /** Acciones disponibles */
  actions: {
    startDrag: (item: BracketDragItem) => void
    endDrag: () => void
    setDragOver: (target: BracketDropTarget | null) => void
    startAnimation: (type: BracketAnimationState['animationType'], target: string) => void
    endAnimation: () => void
    addPendingOperation: (operation: BracketSwapOperation) => void
    clearPendingOperations: () => void
    reset: () => void
  }
}

// ============================================================================
// ESTADO INICIAL
// ============================================================================

const initialState: ExtendedBracketDragState = {
  isDragging: false,
  draggedItem: null,
  dragOverTarget: null,
  animation: {
    isAnimating: false,
    animationType: null,
    targetElement: null
  },
  pendingOperations: []
}

// ============================================================================
// REDUCER
// ============================================================================

function bracketDragReducer(
  state: ExtendedBracketDragState, 
  action: BracketDragAction
): ExtendedBracketDragState {
  
  switch (action.type) {
    case 'START_DRAG':
      return {
        ...state,
        isDragging: true,
        draggedItem: action.payload.item,
        dragOverTarget: null,
        animation: {
          isAnimating: true,
          animationType: 'drag-start',
          targetElement: action.payload.item.coupleId
        }
      }
      
    case 'END_DRAG':
      return {
        ...state,
        isDragging: false,
        draggedItem: null,
        dragOverTarget: null,
        animation: {
          isAnimating: true,
          animationType: 'drag-end',
          targetElement: state.draggedItem?.coupleId || null
        }
      }
      
    case 'SET_DRAG_OVER':
      return {
        ...state,
        dragOverTarget: action.payload.target
      }
      
    case 'START_ANIMATION':
      return {
        ...state,
        animation: {
          isAnimating: true,
          animationType: action.payload.type,
          targetElement: action.payload.target
        }
      }
      
    case 'END_ANIMATION':
      return {
        ...state,
        animation: {
          isAnimating: false,
          animationType: null,
          targetElement: null
        }
      }
      
    case 'ADD_PENDING_OPERATION':
      return {
        ...state,
        pendingOperations: [...state.pendingOperations, action.payload.operation]
      }
      
    case 'CLEAR_PENDING_OPERATIONS':
      return {
        ...state,
        pendingOperations: []
      }
      
    case 'RESET':
      return initialState
      
    default:
      return state
  }
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const BracketDragDropContext = createContext<BracketDragDropContextValue | null>(null)

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function BracketDragDropProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(bracketDragReducer, initialState)
  
  // Action creators con useCallback para optimización
  const startDrag = useCallback((item: BracketDragItem) => {
    dispatch({ type: 'START_DRAG', payload: { item } })
  }, [])
  
  const endDrag = useCallback(() => {
    dispatch({ type: 'END_DRAG' })
    
    // Terminar animación de drag después de un delay
    setTimeout(() => {
      dispatch({ type: 'END_ANIMATION' })
    }, 300)
  }, [])
  
  const setDragOver = useCallback((target: BracketDropTarget | null) => {
    dispatch({ type: 'SET_DRAG_OVER', payload: { target } })
  }, [])
  
  const startAnimation = useCallback((
    type: BracketAnimationState['animationType'], 
    target: string
  ) => {
    dispatch({ type: 'START_ANIMATION', payload: { type, target } })
  }, [])
  
  const endAnimation = useCallback(() => {
    dispatch({ type: 'END_ANIMATION' })
  }, [])
  
  const addPendingOperation = useCallback((operation: BracketSwapOperation) => {
    dispatch({ type: 'ADD_PENDING_OPERATION', payload: { operation } })
  }, [])
  
  const clearPendingOperations = useCallback(() => {
    dispatch({ type: 'CLEAR_PENDING_OPERATIONS' })
  }, [])
  
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])
  
  // Context value
  const contextValue: BracketDragDropContextValue = {
    state,
    actions: {
      startDrag,
      endDrag,
      setDragOver,
      startAnimation,
      endAnimation,
      addPendingOperation,
      clearPendingOperations,
      reset
    }
  }
  
  return (
    <BracketDragDropContext.Provider value={contextValue}>
      {children}
    </BracketDragDropContext.Provider>
  )
}

// ============================================================================
// HOOK PARA USAR EL CONTEXT
// ============================================================================

/**
 * Hook para acceder al context de drag & drop del bracket
 * 
 * @throws Error si se usa fuera del BracketDragDropProvider
 */
export function useBracketDragDrop() {
  const context = useContext(BracketDragDropContext)
  
  if (!context) {
    throw new Error(
      'useBracketDragDrop must be used within a BracketDragDropProvider'
    )
  }
  
  return context
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default BracketDragDropProvider