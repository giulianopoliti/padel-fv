/**
 * LAYOUT TYPES - SISTEMA DE POSICIONAMIENTO Y RENDERIZADO
 * 
 * Tipos especializados para el cálculo y renderizado visual de brackets.
 * Separa la lógica de datos (bracket-types) de la lógica visual (layout-types).
 * 
 * RESPONSABILIDADES:
 * - Posicionamiento de matches en el grid
 * - Cálculo de dimensiones y espaciado
 * - Configuración responsive
 * - Líneas conectoras SVG
 * - Estados visuales de componentes
 * 
 * @author Claude Code Assistant
 * @version 2.0.0
 * @created 2025-01-17
 */

import type { 
  BracketMatchV2, 
  Round, 
  BracketConfig,
  BracketLayoutConfig 
} from './bracket-types'

// ============================================================================
// COORDENADAS Y DIMENSIONES
// ============================================================================

/**
 * Punto en coordenadas 2D
 */
export interface Point2D {
  x: number
  y: number
}

/**
 * Rectángulo con posición y tamaño
 */
export interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Dimensiones básicas
 */
export interface Dimensions {
  width: number
  height: number
}

/**
 * Espaciado (padding/margin)
 */
export interface Spacing {
  top: number
  right: number
  bottom: number
  left: number
}

// ============================================================================
// CONFIGURACIÓN DE LAYOUT
// ============================================================================

/**
 * Configuración responsive por breakpoint
 */
export interface ResponsiveLayoutConfig {
  /** Breakpoint mínimo en px */
  minWidth: number
  /** Configuración de layout para este breakpoint */
  layout: BracketLayoutConfig
  /** Número máximo de columnas visibles */
  maxColumns?: number
  /** Si debe usar scroll horizontal */
  enableHorizontalScroll?: boolean
}

/**
 * Configuración de grid para el bracket
 */
export interface BracketGridConfig {
  /** Configuraciones responsive */
  responsive: ResponsiveLayoutConfig[]
  /** Espaciado entre elementos */
  spacing: {
    /** Entre matches en la misma columna */
    matchVertical: number
    /** Entre columnas (rounds) */
    columnHorizontal: number
    /** Padding del contenedor */
    container: Spacing
  }
  /** Configuración de líneas conectoras */
  connectors: {
    /** Grosor de líneas */
    strokeWidth: number
    /** Color de líneas */
    strokeColor: string
    /** Radio de esquinas */
    cornerRadius: number
    /** Offset horizontal desde match */
    horizontalOffset: number
  }
}

// ============================================================================
// POSICIONAMIENTO DE MATCHES
// ============================================================================

/**
 * Posición calculada de un match en el layout
 */
export interface MatchLayoutPosition {
  /** Match asociado */
  match: BracketMatchV2
  /** Rectángulo de posición */
  bounds: Rectangle
  /** Round al que pertenece */
  round: Round
  /** Índice del round (0 = primer round) */
  roundIndex: number
  /** Posición dentro del round */
  positionInRound: number
  /** Metadatos de cálculo */
  metadata: {
    /** Si el match es visible en viewport actual */
    isVisible: boolean
    /** Si tiene conexiones hacia la izquierda */
    hasLeftConnections: boolean
    /** Si tiene conexiones hacia la derecha */
    hasRightConnections: boolean
    /** IDs de matches conectados */
    connectedMatches: string[]
  }
}

/**
 * Información de una columna (round) en el layout
 */
export interface RoundColumnInfo {
  /** Round representado */
  round: Round
  /** Índice de la columna */
  columnIndex: number
  /** Posición X de la columna */
  x: number
  /** Ancho de la columna */
  width: number
  /** Matches en esta columna */
  matches: MatchLayoutPosition[]
  /** Metadatos de la columna */
  metadata: {
    /** Número total de matches */
    totalMatches: number
    /** Altura total necesaria */
    totalHeight: number
    /** Si la columna es visible */
    isVisible: boolean
  }
}

// ============================================================================
// LÍNEAS CONECTORAS
// ============================================================================

/**
 * Tipo de línea conectora
 */
export type ConnectorLineType = 
  | 'horizontal'     // Línea horizontal entre matches
  | 'vertical'       // Línea vertical de conexión
  | 'corner'         // Esquina en L
  | 'straight'       // Línea recta simple

/**
 * Definición de una línea conectora SVG
 */
export interface ConnectorLine {
  /** ID único de la línea */
  id: string
  /** Tipo de línea */
  type: ConnectorLineType
  /** Puntos que definen la línea */
  points: Point2D[]
  /** Grosor de línea */
  strokeWidth: number
  /** Color de línea */
  strokeColor: string
  /** Match de origen */
  sourceMatchId: string
  /** Match de destino */
  targetMatchId: string
  /** Round de origen */
  sourceRound: Round
  /** Round de destino */
  targetRound: Round
  /** Metadatos visuales */
  metadata: {
    /** Si la línea está activa/resaltada */
    isActive: boolean
    /** Si conecta un match con BYE */
    connectsBYE: boolean
    /** Clase CSS para styling */
    cssClass: string
  }
}

/**
 * Grupo de líneas conectoras
 */
export interface ConnectorGroup {
  /** ID del grupo */
  id: string
  /** Líneas en el grupo */
  lines: ConnectorLine[]
  /** Área que ocupan las líneas */
  bounds: Rectangle
  /** Round que conecta */
  connectsRounds: [Round, Round]
}

// ============================================================================
// VIEWPORT Y SCROLL
// ============================================================================

/**
 * Información del viewport actual
 */
export interface ViewportInfo {
  /** Dimensiones del viewport */
  dimensions: Dimensions
  /** Posición de scroll */
  scroll: Point2D
  /** Área visible */
  visibleArea: Rectangle
  /** Factor de zoom */
  zoomLevel: number
}

/**
 * Configuración de scroll y navegación
 */
export interface ScrollConfig {
  /** Si habilitar scroll horizontal */
  enableHorizontalScroll: boolean
  /** Si habilitar scroll vertical */
  enableVerticalScroll: boolean
  /** Velocidad de scroll suave */
  smoothScrollSpeed: number
  /** Margen para scroll automático */
  autoScrollMargin: number
}

// ============================================================================
// LAYOUT COMPLETO
// ============================================================================

/**
 * Layout completo calculado del bracket
 */
export interface BracketLayout {
  /** Dimensiones totales necesarias */
  totalDimensions: Dimensions
  /** Configuración usada */
  config: BracketGridConfig
  /** Información de viewport */
  viewport: ViewportInfo
  /** Columnas de rounds */
  columns: RoundColumnInfo[]
  /** Todas las posiciones de matches */
  matchPositions: MatchLayoutPosition[]
  /** Líneas conectoras */
  connectors: ConnectorGroup[]
  /** Metadatos de cálculo */
  metadata: {
    /** Timestamp de cálculo */
    calculatedAt: string
    /** Tiempo de cálculo en ms */
    calculationTime: number
    /** Configuración responsive activa */
    activeBreakpoint: ResponsiveLayoutConfig
    /** Si el layout es válido */
    isValid: boolean
    /** Warnings durante cálculo */
    warnings: string[]
  }
}

// ============================================================================
// ESTADOS DE ANIMACIÓN
// ============================================================================

/**
 * Estado de animación de un match
 */
export type MatchAnimationState = 
  | 'idle'           // Sin animación
  | 'entering'       // Apareciendo
  | 'exiting'        // Desapareciendo
  | 'moving'         // Cambiando posición
  | 'highlighting'   // Siendo resaltado
  | 'pulsing'        // Pulsando (notificación)

/**
 * Configuración de animaciones
 */
export interface AnimationConfig {
  /** Duración por defecto en ms */
  defaultDuration: number
  /** Easing function */
  easing: string
  /** Si habilitar animaciones */
  enabled: boolean
  /** Configuraciones específicas */
  specific: {
    /** Animación de entrada de matches */
    matchEnter: {
      duration: number
      delay: number
      easing: string
    }
    /** Animación de líneas conectoras */
    connectorDraw: {
      duration: number
      delay: number
      easing: string
    }
    /** Transiciones de scroll */
    scroll: {
      duration: number
      easing: string
    }
  }
}

// ============================================================================
// INTERACCIONES Y EVENTOS
// ============================================================================

/**
 * Evento de interacción con el layout
 */
export interface LayoutInteractionEvent {
  /** Tipo de evento */
  type: 'click' | 'hover' | 'scroll' | 'resize' | 'zoom'
  /** Posición del evento */
  position: Point2D
  /** Elemento afectado */
  target: {
    /** Tipo de elemento */
    type: 'match' | 'connector' | 'background'
    /** ID del elemento (si aplica) */
    id?: string
    /** Datos del elemento */
    data?: any
  }
  /** Timestamp del evento */
  timestamp: string
}

/**
 * Configuración de interacciones
 */
export interface InteractionConfig {
  /** Si habilitar hover effects */
  enableHover: boolean
  /** Si habilitar tooltips */
  enableTooltips: boolean
  /** Si habilitar zoom */
  enableZoom: boolean
  /** Configuración de zoom */
  zoom: {
    /** Nivel mínimo */
    min: number
    /** Nivel máximo */
    max: number
    /** Paso de zoom */
    step: number
    /** Punto de zoom por defecto */
    default: number
  }
}

// ============================================================================
// TIPOS DE HOOKS
// ============================================================================

/**
 * Configuración del hook useBracketLayout
 */
export interface UseBracketLayoutConfig {
  /** Configuración de grid */
  gridConfig?: Partial<BracketGridConfig>
  /** Configuración de animaciones */
  animationConfig?: Partial<AnimationConfig>
  /** Configuración de interacciones */
  interactionConfig?: Partial<InteractionConfig>
  /** Si recalcular automáticamente en resize */
  autoRecalculate?: boolean
  /** Debounce para recálculo en ms */
  recalculateDebounce?: number
}

/**
 * Resultado del hook useBracketLayout
 */
export interface UseBracketLayoutResult {
  /** Layout calculado */
  layout: BracketLayout | null
  /** Si está calculando */
  calculating: boolean
  /** Error de cálculo */
  error: Error | null
  /** Función para recalcular */
  recalculate: () => void
  /** Función para scroll a match */
  scrollToMatch: (matchId: string) => void
  /** Función para zoom */
  setZoom: (level: number) => void
  /** Configuración actual */
  config: BracketGridConfig
}

// ============================================================================
// UTILIDADES DE CÁLCULO
// ============================================================================

/**
 * Resultado de cálculo de posición
 */
export interface PositionCalculationResult {
  /** Posiciones calculadas */
  positions: MatchLayoutPosition[]
  /** Dimensiones totales */
  totalDimensions: Dimensions
  /** Tiempo de cálculo */
  calculationTime: number
  /** Si el cálculo es válido */
  isValid: boolean
  /** Errores encontrados */
  errors: string[]
}

/**
 * Parámetros para cálculo de conectores
 */
export interface ConnectorCalculationParams {
  /** Posiciones de matches */
  matchPositions: MatchLayoutPosition[]
  /** Configuración de conectores */
  connectorConfig: BracketGridConfig['connectors']
  /** Área de renderizado */
  renderArea: Rectangle
}

/**
 * Resultado de cálculo de conectores
 */
export interface ConnectorCalculationResult {
  /** Grupos de conectores */
  groups: ConnectorGroup[]
  /** Líneas individuales */
  lines: ConnectorLine[]
  /** Área total ocupada */
  totalBounds: Rectangle
  /** Tiempo de cálculo */
  calculationTime: number
}