/**
 * BRACKET CONSTANTS - CONFIGURACIONES BASE DEL SISTEMA
 * 
 * Configuraciones predefinidas para diferentes tipos de brackets y algoritmos.
 * Estas constantes definen el comportamiento por defecto del sistema y pueden
 * ser sobreescritas por configuraciones específicas del torneo.
 * 
 * @author Claude Code Assistant
 * @version 2.0.0
 * @created 2025-01-17
 */

import type {
  BracketConfig,
  BracketLayoutConfig,
  BracketFeatures,
  BracketAlgorithm,
  Round
} from '../types/bracket-types'

// ============================================================================
// CONFIGURACIONES DE LAYOUT
// ============================================================================

/**
 * Layout base responsive para diferentes dispositivos
 */
export const LAYOUT_CONFIGS: Record<string, BracketLayoutConfig> = {
  /** Layout para dispositivos móviles */
  mobile: {
    columnWidth: 280,
    matchHeight: 120,
    spacing: 15,
    responsive: true
  },
  
  /** Layout para tablets */
  tablet: {
    columnWidth: 320,
    matchHeight: 130,
    spacing: 18,
    responsive: true
  },
  
  /** Layout para desktop */
  desktop: {
    columnWidth: 340,
    matchHeight: 135,
    spacing: 20,
    responsive: true
  }
} as const

// ============================================================================
// CONFIGURACIONES DE FEATURES
// ============================================================================

/**
 * Features habilitadas para diferentes tipos de usuario
 */
export const FEATURE_CONFIGS: Record<string, BracketFeatures> = {
  /** Configuración para propietarios (máximas features) */
  owner: {
    showSeeds: true,
    showZoneInfo: true,
    enableDragDrop: true,
    enableLiveScoring: true,
    showStatistics: true,
    autoProcessBYEs: true
  },
  
  /** Configuración para vista pública (solo lectura) */
  public: {
    showSeeds: true,
    showZoneInfo: true,
    enableDragDrop: false,
    enableLiveScoring: false,
    showStatistics: false,
    autoProcessBYEs: false
  }
} as const

// ============================================================================
// CONFIGURACIONES POR ALGORITMO
// ============================================================================

/**
 * Configuración específica para algoritmo serpenteo
 */
export const SERPENTINE_CONFIG: BracketConfig = {
  matchFormat: 'best-of-1',
  scoring: 'standard',
  algorithm: 'serpentine',
  layout: {
    ...LAYOUT_CONFIGS.desktop,
    columnWidth: 350,
    matchHeight: 140
  },
  features: {
    ...FEATURE_CONFIGS.owner,
    showZoneInfo: true
  }
} as const

/**
 * Configuración específica para algoritmo tradicional
 */
export const TRADITIONAL_CONFIG: BracketConfig = {
  matchFormat: 'best-of-1',
  scoring: 'standard',
  algorithm: 'traditional',
  layout: LAYOUT_CONFIGS.desktop,
  features: FEATURE_CONFIGS.owner
} as const

/**
 * Configuraciones predefinidas por algoritmo
 */
export const BRACKET_CONFIGS: Record<BracketAlgorithm, BracketConfig> = {
  traditional: TRADITIONAL_CONFIG,
  serpentine: SERPENTINE_CONFIG,
  custom: SERPENTINE_CONFIG
} as const

// ============================================================================
// CONSTANTES DE ROUNDS
// ============================================================================

/**
 * Orden de rounds para layout
 */
export const ROUND_ORDER: Round[] = [
  '32VOS',
  '16VOS',
  '8VOS',
  '4TOS',
  'SEMIFINAL',
  'FINAL'
] as const

/**
 * Traducciones de rounds para display
 */
export const ROUND_TRANSLATIONS: Record<Round, string> = {
  '32VOS': '32vos de Final',
  '16VOS': '16vos de Final',
  '8VOS': 'Octavos de Final',
  '4TOS': 'Cuartos de Final',
  'SEMIFINAL': 'Semifinal',
  'FINAL': 'Final'
} as const

// ============================================================================
// EXPORT PRINCIPAL
// ============================================================================

/**
 * Configuración por defecto del sistema
 */
export const DEFAULT_BRACKET_CONFIG: BracketConfig = SERPENTINE_CONFIG

/**
 * Función para obtener configuración por algoritmo
 */
export function getBracketConfigForAlgorithm(algorithm: BracketAlgorithm): BracketConfig {
  return BRACKET_CONFIGS[algorithm] || DEFAULT_BRACKET_CONFIG
}

/**
 * Función para obtener configuración responsiva según ancho de pantalla
 */
export function getResponsiveLayoutConfig(screenWidth: number): BracketLayoutConfig {
  if (screenWidth < 768) {
    return LAYOUT_CONFIGS.mobile
  } else if (screenWidth < 1024) {
    return LAYOUT_CONFIGS.tablet
  } else {
    return LAYOUT_CONFIGS.desktop
  }
}

/**
 * Función para obtener configuración de features según rol de usuario
 */
export function getFeaturesForUserRole(isOwner: boolean, isPublic: boolean): BracketFeatures {
  if (isOwner) {
    return FEATURE_CONFIGS.owner
  } else {
    return FEATURE_CONFIGS.public
  }
}