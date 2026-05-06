/**
 * COMPONENTES BRACKET V2 - EXPORTS
 * 
 * Punto central de exportación para todos los componentes del sistema
 * BracketVisualizationV2.
 * 
 * @author Claude Code Assistant
 * @version 2.0.0
 * @created 2025-01-17
 */

// Componentes principales
export { MatchCard } from './MatchCard'
export type { MatchCardProps, MatchCardConfig } from './MatchCard'

// Re-exports para facilitar imports
export type {
  // Layout types
  BracketLayout,
  MatchLayoutPosition,
  RoundColumnInfo,
  ConnectorGroup,
  ViewportInfo,
  BracketGridConfig,
  UseBracketLayoutConfig,
  UseBracketLayoutResult,
  
  // Geometry types
  Point2D,
  Rectangle,
  Dimensions,
  Spacing
} from '../types/layout-types'

export type {
  // Bracket types
  BracketMatchV2,
  BracketData,
  BracketConfig,
  ParticipantSlot,
  CoupleData,
  SeedInfo,
  MatchStatus,
  Round,
  BracketState,
  BracketAlgorithm
} from '../types/bracket-types'