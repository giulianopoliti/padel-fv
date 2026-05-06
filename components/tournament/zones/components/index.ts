/**
 * Zone Components Index
 * 
 * Centralized exports for zone-related components with enhanced validation.
 */

// Core zone components
export { ZoneCard } from './ZoneCard'
export { UnassignedPool } from './UnassignedPool'
export { CoupleRow } from './CoupleRow'

// Zone management components
export { 
  ZoneManagement, 
  ZoneDeleteButton, 
  ZoneCreationButton 
} from './ZoneManagement'

// Position and statistics
export { ZonePositions } from './ZonePositions'
export { ZoneActions } from './ZoneActions'

// Enhanced validation and feedback components
export { 
  ZoneCapacityIndicator,
  ZoneCapacityBadge,
  ZoneCapacityDetails
} from './ZoneCapacityIndicator'

export {
  DragDropFeedback,
  SimpleDragFeedback,
  ZoneDragFeedback,
  ConsequencePreview
} from './DragDropFeedback'