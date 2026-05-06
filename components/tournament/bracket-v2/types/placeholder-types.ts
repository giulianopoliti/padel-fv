/**
 * PLACEHOLDER TYPES - SISTEMA DE PLACEHOLDERS DINÁMICOS
 * 
 * Tipos específicos para el sistema de placeholders que permite mostrar
 * brackets antes de que terminen las zonas, usando información definitiva
 * de la tabla zone_positions.is_definitive
 * 
 * @author Claude Code Assistant
 * @version 2.0.0
 * @created 2025-01-17
 */

import type { 
  CoupleData, 
  SeedInfo, 
  PlaceholderRule,
  BracketAlgorithm 
} from './bracket-types'

// ============================================================================
// TIPOS DE PLACEHOLDER
// ============================================================================

/**
 * Estados de resolución de un placeholder
 */
export type PlaceholderResolutionState = 
  | 'pending'     // Aún no se puede resolver
  | 'definitive'  // Ya se puede resolver (is_definitive = true)
  | 'resolved'    // Ya resuelto a una pareja específica
  | 'error'       // Error en la resolución

/**
 * Información extendida de placeholder
 */
export interface PlaceholderInfo {
  /** ID único del placeholder */
  id: string
  /** Texto principal a mostrar */
  display: string
  /** Texto secundario (opcional) */
  subtitle?: string
  /** Regla de resolución */
  rule: PlaceholderRule
  /** Estado actual */
  state: PlaceholderResolutionState
  /** Pareja resuelta (si state === 'resolved') */
  resolvedCouple?: CoupleData
  /** Información de seed si está disponible */
  seedInfo?: SeedInfo
  /** Metadatos adicionales */
  metadata?: {
    /** Timestamp de última verificación */
    lastChecked: string
    /** Si se debe verificar automáticamente */
    autoResolve: boolean
    /** Confianza en la resolución (0-1) */
    confidence?: number
  }
}

/**
 * Configuración para la generación de placeholders
 */
export interface PlaceholderGenerationConfig {
  /** Algoritmo base para la generación */
  algorithm: BracketAlgorithm
  /** Si incluir placeholders para todas las posiciones */
  includeAllPositions: boolean
  /** Si mostrar información de zonas */
  showZoneInfo: boolean
  /** Si mostrar seeds estimados */
  showEstimatedSeeds: boolean
  /** Prefijo para displays de zona */
  zoneDisplayPrefix?: string
}

// ============================================================================
// REGLAS ESPECÍFICAS DE PLACEHOLDER
// ============================================================================

/**
 * Regla para ganador/segundo/etc de zona
 */
export interface ZonePositionRule {
  type: 'zone-position'
  /** ID de la zona */
  zoneId: string
  /** Posición en la zona (1 = ganador, 2 = segundo, etc) */
  position: number
  /** Nombre de la zona para display */
  zoneName?: string
}

/**
 * Regla para ganador de un match específico
 */
export interface MatchWinnerRule {
  type: 'match-winner'
  /** ID del match padre */
  parentMatchId: string
  /** Round del match padre */
  parentRound?: string
  /** Descripción del match padre */
  parentDescription?: string
}

/**
 * Regla personalizada (para extensiones futuras)
 */
export interface CustomPlaceholderRule {
  type: 'custom'
  /** Identificador de la regla personalizada */
  customType: string
  /** Parámetros específicos */
  parameters: Record<string, any>
}

/**
 * Union type de todas las reglas posibles
 */
export type PlaceholderRuleUnion = 
  | ZonePositionRule 
  | MatchWinnerRule 
  | CustomPlaceholderRule

// ============================================================================
// CONTEXTO DE RESOLUCIÓN
// ============================================================================

/**
 * Contexto necesario para resolver placeholders
 */
export interface PlaceholderResolutionContext {
  /** ID del torneo */
  tournamentId: string
  /** Datos actuales de zonas */
  zones: ZoneContextData[]
  /** Información de seeds disponible */
  seeds: SeedInfo[]
  /** Matches existentes para resolución de match-winners */
  existingMatches: MatchContextData[]
  /** Timestamp del contexto */
  timestamp: string
}

/**
 * Datos de zona para resolución
 */
export interface ZoneContextData {
  id: string
  name: string
  /** Posiciones definitivas conocidas */
  definitivePositions: ZonePositionData[]
  /** Si la zona está completamente finalizada */
  isCompleted: boolean
}

/**
 * Datos de posición en zona
 */
export interface ZonePositionData {
  /** Posición (1, 2, 3, 4) */
  position: number
  /** ID de la pareja */
  coupleId: string
  /** Si esta posición ya es definitiva */
  isDefinitive: boolean
  /** Datos de la pareja */
  coupleData?: CoupleData
  /** Información estadística */
  stats?: {
    points: number
    wins: number
    losses: number
    gamesDifference: number
  }
}

/**
 * Datos de match para resolución
 */
export interface MatchContextData {
  id: string
  round: string
  status: string
  winnerId?: string
  winnerData?: CoupleData
}

// ============================================================================
// RESULTADOS DE RESOLUCIÓN
// ============================================================================

/**
 * Resultado de intentar resolver un placeholder
 */
export interface PlaceholderResolutionResult {
  /** Si la resolución fue exitosa */
  success: boolean
  /** Estado resultante */
  state: PlaceholderResolutionState
  /** Pareja resuelta (si success = true) */
  resolvedCouple?: CoupleData
  /** Información de seed (si está disponible) */
  seedInfo?: SeedInfo
  /** Razón del fallo (si success = false) */
  failureReason?: string
  /** Metadatos de la resolución */
  metadata?: {
    /** Método usado para resolver */
    resolutionMethod: string
    /** Confianza en el resultado */
    confidence: number
    /** Timestamp de resolución */
    resolvedAt: string
  }
}

/**
 * Resultado de resolver múltiples placeholders
 */
export interface BulkPlaceholderResolutionResult {
  /** Total de placeholders procesados */
  totalProcessed: number
  /** Resueltos exitosamente */
  resolved: number
  /** Marcados como definitivos pero no resueltos aún */
  definitive: number
  /** Que siguen pendientes */
  stillPending: number
  /** Con errores */
  errors: number
  /** Resultados individuales */
  results: Array<{
    placeholderId: string
    result: PlaceholderResolutionResult
  }>
}

// ============================================================================
// CONFIGURACIONES ESPECÍFICAS POR ALGORITMO
// ============================================================================

/**
 * Configuración de placeholders para algoritmo serpenteo
 */
export interface SerpentinePlaceholderConfig {
  algorithm: 'serpentine'
  /** Garantía del algoritmo */
  guarantee: string
  /** Patrón de seeds */
  seedPattern: {
    /** Descripción del patrón */
    description: string
    /** Mapeo de posición en zona a seed aproximado */
    zonePositionToSeed: Record<number, number[]>
  }
  /** Configuración de display */
  display: {
    /** Formato para ganadores de zona */
    zoneWinnerFormat: string
    /** Formato para segundos de zona */
    zoneRunnerUpFormat: string
    /** Mostrar seeds estimados */
    showEstimatedSeeds: boolean
  }
}

/**
 * Configuración de placeholders para algoritmo tradicional
 */
export interface TraditionalPlaceholderConfig {
  algorithm: 'traditional'
  /** Ordenamiento estándar por performance */
  standardSeeding: boolean
  /** Configuración de display */
  display: {
    /** Formato simple */
    simpleFormat: string
    /** Mostrar solo posiciones */
    positionsOnly: boolean
  }
}

/**
 * Union type de configuraciones por algoritmo
 */
export type AlgorithmPlaceholderConfig = 
  | SerpentinePlaceholderConfig 
  | TraditionalPlaceholderConfig

// ============================================================================
// EVENTOS Y ACTUALIZACIONES
// ============================================================================

/**
 * Evento de actualización de placeholder
 */
export interface PlaceholderUpdateEvent {
  /** Tipo de evento */
  type: 'resolution' | 'definitive_change' | 'error' | 'context_update'
  /** ID del placeholder afectado */
  placeholderId: string
  /** Nuevo estado */
  newState: PlaceholderResolutionState
  /** Datos del cambio */
  changeData?: {
    /** Estado anterior */
    previousState?: PlaceholderResolutionState
    /** Nueva pareja resuelta */
    newResolvedCouple?: CoupleData
    /** Timestamp del cambio */
    timestamp: string
  }
}

/**
 * Suscripción a actualizaciones de placeholders
 */
export interface PlaceholderSubscription {
  /** ID de la suscripción */
  id: string
  /** Placeholders de interés */
  placeholderIds: string[]
  /** Callback para actualizaciones */
  onUpdate: (event: PlaceholderUpdateEvent) => void
  /** Si debe incluir actualizaciones de contexto */
  includeContextUpdates: boolean
}

// ============================================================================
// UTILIDADES DE DISPLAY
// ============================================================================

/**
 * Opciones para formatear el display de un placeholder
 */
export interface PlaceholderDisplayOptions {
  /** Incluir información de zona */
  includeZoneInfo: boolean
  /** Incluir seed estimado */
  includeEstimatedSeed: boolean
  /** Formato compacto */
  compact: boolean
  /** Mostrar estado de resolución */
  showResolutionState: boolean
  /** Tema de iconos */
  iconTheme?: 'default' | 'minimal' | 'sport'
}

/**
 * Resultado de formatear un placeholder para display
 */
export interface FormattedPlaceholderDisplay {
  /** Texto principal */
  primary: string
  /** Texto secundario (opcional) */
  secondary?: string
  /** Icono sugerido */
  icon?: string
  /** Clase CSS sugerida */
  cssClass?: string
  /** Si debe mostrar estado de loading */
  showLoading: boolean
  /** Tooltip explicativo */
  tooltip?: string
}