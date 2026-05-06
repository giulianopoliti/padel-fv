// Enhanced Tournament Components
// Componentes rediseñados con diseño "exótico" pero profesional
// Usando paleta azul oscuro/blanco/negro y componentes shadcn/ui

export { default as PlayerAvatar } from './PlayerAvatar'
export { default as SetScoreDisplay } from './SetScoreDisplay'
export { default as MatchStatusBadge, getMatchStatus } from './MatchStatusBadge'
export { default as EnhancedMatchCard } from './EnhancedMatchCard'
export { default as TournamentSkeleton } from './TournamentSkeleton'

// Re-export types if needed
export type {
  PlayerAvatarProps,
  SetScoreDisplayProps,
  MatchStatusBadgeProps,
  EnhancedMatchCardProps,
  TournamentSkeletonProps
} from './types'