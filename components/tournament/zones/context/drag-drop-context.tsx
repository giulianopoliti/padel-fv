"use client"

/**
 * Drag and Drop Context Provider
 * 
 * Manages drag and drop state using React Context.
 * Handles rich animations and smooth transitions.
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react'
import type { 
  DragState, 
  DragItem, 
  DropTarget, 
  DragOperation,
  AnimationState 
} from '../types/drag-types'

// Extended state including animations
interface ExtendedDragState extends DragState {
  animation: AnimationState
  pendingOperations: DragOperation[]
}

// Action types for reducer
type DragAction = 
  | { type: 'START_DRAG'; payload: { item: DragItem } }
  | { type: 'END_DRAG' }
  | { type: 'SET_DRAG_OVER'; payload: { target: DropTarget | null } }
  | { type: 'START_ANIMATION'; payload: { type: AnimationState['animationType']; target: string } }
  | { type: 'END_ANIMATION' }
  | { type: 'ADD_PENDING_OPERATION'; payload: { operation: DragOperation } }
  | { type: 'CLEAR_PENDING_OPERATIONS' }
  | { type: 'RESET' }

// Context interface
interface DragDropContextValue {
  state: ExtendedDragState
  actions: {
    startDrag: (item: DragItem) => void
    endDrag: () => void
    setDragOver: (target: DropTarget | null) => void
    startAnimation: (type: AnimationState['animationType'], target: string) => void
    endAnimation: () => void
    addPendingOperation: (operation: DragOperation) => void
    clearPendingOperations: () => void
    reset: () => void
  }
}

// Initial state
const initialState: ExtendedDragState = {
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

// Reducer
function dragDropReducer(state: ExtendedDragState, action: DragAction): ExtendedDragState {
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

// Create contexts
const DragDropContext = createContext<DragDropContextValue | null>(null)

// Provider component
export function DragDropProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(dragDropReducer, initialState)
  
  // Action creators
  const startDrag = useCallback((item: DragItem) => {
    dispatch({ type: 'START_DRAG', payload: { item } })
  }, [])
  
  const endDrag = useCallback(() => {
    dispatch({ type: 'END_DRAG' })
    
    // End drag animation after a brief delay
    setTimeout(() => {
      dispatch({ type: 'END_ANIMATION' })
    }, 300)
  }, [])
  
  const setDragOver = useCallback((target: DropTarget | null) => {
    dispatch({ type: 'SET_DRAG_OVER', payload: { target } })
  }, [])
  
  const startAnimation = useCallback((type: AnimationState['animationType'], target: string) => {
    dispatch({ type: 'START_ANIMATION', payload: { type, target } })
  }, [])
  
  const endAnimation = useCallback(() => {
    dispatch({ type: 'END_ANIMATION' })
  }, [])
  
  const addPendingOperation = useCallback((operation: DragOperation) => {
    dispatch({ type: 'ADD_PENDING_OPERATION', payload: { operation } })
  }, [])
  
  const clearPendingOperations = useCallback(() => {
    dispatch({ type: 'CLEAR_PENDING_OPERATIONS' })
  }, [])
  
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])
  
  const contextValue: DragDropContextValue = {
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
    <DragDropContext.Provider value={contextValue}>
      {children}
    </DragDropContext.Provider>
  )
}

// Hook to use drag drop context
export function useDragDrop() {
  const context = useContext(DragDropContext)
  
  if (!context) {
    throw new Error('useDragDrop must be used within a DragDropProvider')
  }
  
  return context
}