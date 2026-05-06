/**
 * Drag and Drop Types
 * 
 * Clean types for drag and drop operations using only IDs and basic data
 * to avoid serialization issues.
 */

// Types of draggable items
export type DragItemType = 'zone-couple' | 'available-couple'

// Base drag item with minimal data
export interface BaseDragItem {
  type: DragItemType
  coupleId: string
  coupleName: string // For display purposes
}

// Couple being dragged from a zone
export interface ZoneCoupleItem extends BaseDragItem {
  type: 'zone-couple'
  sourceZoneId: string
}

// Couple being dragged from available pool
export interface AvailableCoupleItem extends BaseDragItem {
  type: 'available-couple'
}

// Union type for all draggable items
export type DragItem = ZoneCoupleItem | AvailableCoupleItem

// Drop targets
export interface DropTarget {
  type: 'zone' | 'trash' | 'available-pool'
  id: string // zone ID for zones, 'trash' for delete, 'pool' for available
  name: string // Display name
}

// Drag operation state
export interface DragState {
  isDragging: boolean
  draggedItem: DragItem | null
  dragOverTarget: DropTarget | null
}

// Drag operation result
export interface DragOperation {
  type: 'move-to-zone' | 'move-to-available' | 'delete' | 'swap-zones'
  sourceItem: DragItem
  targetZoneId?: string
  targetCoupleId?: string // For swapping
}

// Animation states
export interface AnimationState {
  isAnimating: boolean
  animationType: 'drag-start' | 'drag-end' | 'drop-success' | 'drop-error' | null
  targetElement: string | null // Element ID for targeting animations
}