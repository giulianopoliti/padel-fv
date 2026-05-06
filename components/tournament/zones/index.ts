/**
 * Tournament Zones - New Architecture
 * 
 * Clean exports for the new zone management system
 */

// Main component
export { default as TournamentZonesMatrix } from './TournamentZonesMatrix'

// Individual components (for custom usage)
export { ZoneCard } from './components/ZoneCard'
export { CoupleRow } from './components/CoupleRow'
export { UnassignedPool } from './components/UnassignedPool'
export { ZoneActions } from './components/ZoneActions'
export { ZoneManagement, ZoneDeleteButton } from './components/ZoneManagement'

// Hooks
export { useTournamentZonesData } from './hooks/use-tournament-zones-data'
export { useDragDropOperations } from './hooks/use-drag-drop'
export { useZoneMutations } from './hooks/use-zone-mutations'

// Context
export { DragDropProvider, useDragDrop } from './context/drag-drop-context'

// Types
export type * from './types/zone-types'
export type * from './types/drag-types'

// Utils
export * from './utils/data-serialization'