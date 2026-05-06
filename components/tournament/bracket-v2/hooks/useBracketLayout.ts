/**
 * HOOK BRACKET LAYOUT - MOTOR DE POSICIONAMIENTO Y RENDERIZADO
 * 
 * Hook especializado para calcular posiciones, dimensiones y líneas conectoras
 * del bracket. Se encarga de la lógica visual y de renderizado.
 * 
 * FUNCIONALIDADES:
 * - Cálculo de posiciones de matches por round
 * - Dimensiones responsive según viewport
 * - Generación de líneas conectoras SVG
 * - Manejo de scroll y zoom
 * - Optimizaciones de performance
 * - Recálculo automático en cambios
 * 
 * @author Claude Code Assistant
 * @version 2.0.0
 * @created 2025-01-17
 */

'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type {
  BracketLayout,
  BracketGridConfig,
  MatchLayoutPosition,
  RoundColumnInfo,
  ConnectorGroup,
  ViewportInfo,
  UseBracketLayoutConfig,
  UseBracketLayoutResult,
  PositionCalculationResult,
  ConnectorCalculationResult,
  ResponsiveLayoutConfig,
  Rectangle,
  Dimensions,
  Point2D
} from '../types/layout-types'
import type {
  BracketData,
  BracketMatchV2,
  Round,
  BracketConfig
} from '../types/bracket-types'

// ============================================================================
// CONFIGURACIONES POR DEFECTO
// ============================================================================

/**
 * Configuración de grid por defecto
 */
const DEFAULT_GRID_CONFIG: BracketGridConfig = {
  responsive: [
    {
      minWidth: 0,
      layout: {
        columnWidth: 280,
        matchHeight: 120,
        spacing: 15,
        responsive: true
      },
      maxColumns: 2,
      enableHorizontalScroll: true
    },
    {
      minWidth: 768,
      layout: {
        columnWidth: 320,
        matchHeight: 130,
        spacing: 18,
        responsive: true
      },
      maxColumns: 4,
      enableHorizontalScroll: true
    },
    {
      minWidth: 1024,
      layout: {
        columnWidth: 340,
        matchHeight: 135,
        spacing: 20,
        responsive: true
      },
      maxColumns: 6,
      enableHorizontalScroll: false
    }
  ],
  spacing: {
    matchVertical: 25,
    columnHorizontal: 60,
    container: {
      top: 20,
      right: 20,
      bottom: 20,
      left: 20
    }
  },
  connectors: {
    strokeWidth: 2,
    strokeColor: '#64748b',
    cornerRadius: 4,
    horizontalOffset: 10
  }
}

/**
 * Orden de rounds para posicionamiento
 */
const ROUND_ORDER: Round[] = ['32VOS', '16VOS', '8VOS', '4TOS', 'SEMIFINAL', 'FINAL']

// ============================================================================
// UTILIDADES DE CÁLCULO
// ============================================================================

/**
 * Obtiene configuración responsive activa basada en viewport
 */
function getActiveResponsiveConfig(
  viewportWidth: number,
  responsiveConfigs: ResponsiveLayoutConfig[]
): ResponsiveLayoutConfig {
  // Buscar configuración que mejor se ajuste al viewport
  const sortedConfigs = [...responsiveConfigs].sort((a, b) => b.minWidth - a.minWidth)
  
  for (const config of sortedConfigs) {
    if (viewportWidth >= config.minWidth) {
      return config
    }
  }
  
  // Fallback a la primera configuración
  return responsiveConfigs[0] || sortedConfigs[sortedConfigs.length - 1]
}

/**
 * Agrupa matches por round
 */
function groupMatchesByRound(matches: BracketMatchV2[]): Map<Round, BracketMatchV2[]> {
  const grouped = new Map<Round, BracketMatchV2[]>()
  
  for (const match of matches) {
    const existing = grouped.get(match.round) || []
    existing.push(match)
    grouped.set(match.round, existing)
  }
  
  // Ordenar matches dentro de cada round por order_in_round
  for (const [round, roundMatches] of grouped) {
    roundMatches.sort((a, b) => a.order_in_round - b.order_in_round)
    grouped.set(round, roundMatches)
  }
  
  return grouped
}

/**
 * Calcula posiciones de matches en el layout
 */
function calculateMatchPositions(
  matches: BracketMatchV2[],
  config: BracketGridConfig,
  viewportInfo: ViewportInfo
): PositionCalculationResult {
  const startTime = performance.now()
  const errors: string[] = []
  
  try {
    const activeConfig = getActiveResponsiveConfig(viewportInfo.dimensions.width, config.responsive)
    const matchesByRound = groupMatchesByRound(matches)
    const positions: MatchLayoutPosition[] = []
    
    let currentX = config.spacing.container.left
    let maxHeight = 0
    
    // Procesar rounds en orden
    for (const round of ROUND_ORDER) {
      const roundMatches = matchesByRound.get(round)
      if (!roundMatches || roundMatches.length === 0) continue
      
      const columnHeight = calculateColumnHeight(roundMatches, activeConfig.layout, config)
      maxHeight = Math.max(maxHeight, columnHeight)
      
      // Calcular posiciones verticales para esta columna
      const startY = config.spacing.container.top
      const availableHeight = columnHeight - config.spacing.container.top - config.spacing.container.bottom
      const totalMatchesHeight = roundMatches.length * activeConfig.layout.matchHeight
      const totalSpacing = (roundMatches.length - 1) * config.spacing.matchVertical
      const extraSpace = availableHeight - totalMatchesHeight - totalSpacing
      const verticalOffset = Math.max(0, extraSpace / 2)
      
      let currentY = startY + verticalOffset
      
      for (let i = 0; i < roundMatches.length; i++) {
        const match = roundMatches[i]
        
        const position: MatchLayoutPosition = {
          match,
          bounds: {
            x: currentX,
            y: currentY,
            width: activeConfig.layout.columnWidth,
            height: activeConfig.layout.matchHeight
          },
          round,
          roundIndex: ROUND_ORDER.indexOf(round),
          positionInRound: i,
          metadata: {
            isVisible: isMatchVisible(
              { x: currentX, y: currentY, width: activeConfig.layout.columnWidth, height: activeConfig.layout.matchHeight },
              viewportInfo
            ),
            hasLeftConnections: ROUND_ORDER.indexOf(round) > 0,
            hasRightConnections: ROUND_ORDER.indexOf(round) < ROUND_ORDER.length - 1,
            connectedMatches: calculateConnectedMatches(match, matches)
          }
        }
        
        positions.push(position)
        currentY += activeConfig.layout.matchHeight + config.spacing.matchVertical
      }
      
      currentX += activeConfig.layout.columnWidth + config.spacing.columnHorizontal
    }
    
    const totalDimensions: Dimensions = {
      width: currentX - config.spacing.columnHorizontal + config.spacing.container.right,
      height: maxHeight
    }
    
    const calculationTime = performance.now() - startTime
    
    return {
      positions,
      totalDimensions,
      calculationTime,
      isValid: positions.length > 0,
      errors
    }
    
  } catch (error) {
    errors.push(`Error calculating positions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    return {
      positions: [],
      totalDimensions: { width: 0, height: 0 },
      calculationTime: performance.now() - startTime,
      isValid: false,
      errors
    }
  }
}

/**
 * Calcula altura necesaria para una columna
 */
function calculateColumnHeight(
  matches: BracketMatchV2[],
  layoutConfig: ResponsiveLayoutConfig['layout'],
  gridConfig: BracketGridConfig
): number {
  const totalMatchesHeight = matches.length * layoutConfig.matchHeight
  const totalSpacing = (matches.length - 1) * gridConfig.spacing.matchVertical
  const containerPadding = gridConfig.spacing.container.top + gridConfig.spacing.container.bottom
  
  return totalMatchesHeight + totalSpacing + containerPadding
}

/**
 * Verifica si un match es visible en el viewport actual
 */
function isMatchVisible(matchBounds: Rectangle, viewportInfo: ViewportInfo): boolean {
  const { visibleArea } = viewportInfo
  
  return !(
    matchBounds.x + matchBounds.width < visibleArea.x ||
    matchBounds.x > visibleArea.x + visibleArea.width ||
    matchBounds.y + matchBounds.height < visibleArea.y ||
    matchBounds.y > visibleArea.y + visibleArea.height
  )
}

/**
 * Calcula matches conectados a un match dado
 */
function calculateConnectedMatches(match: BracketMatchV2, allMatches: BracketMatchV2[]): string[] {
  // Simplified logic - in real implementation would calculate based on bracket tree
  return []
}

/**
 * Calcula información de columnas de rounds
 */
function calculateRoundColumns(
  positions: MatchLayoutPosition[],
  config: BracketGridConfig
): RoundColumnInfo[] {
  const columnMap = new Map<Round, MatchLayoutPosition[]>()
  
  // Agrupar posiciones por round
  for (const position of positions) {
    const existing = columnMap.get(position.round) || []
    existing.push(position)
    columnMap.set(position.round, existing)
  }
  
  const columns: RoundColumnInfo[] = []
  
  for (const round of ROUND_ORDER) {
    const roundPositions = columnMap.get(round)
    if (!roundPositions || roundPositions.length === 0) continue
    
    const firstPosition = roundPositions[0]
    const totalHeight = Math.max(...roundPositions.map(p => p.bounds.y + p.bounds.height))
    
    columns.push({
      round,
      columnIndex: ROUND_ORDER.indexOf(round),
      x: firstPosition.bounds.x,
      width: firstPosition.bounds.width,
      matches: roundPositions,
      metadata: {
        totalMatches: roundPositions.length,
        totalHeight,
        isVisible: roundPositions.some(p => p.metadata.isVisible)
      }
    })
  }
  
  return columns
}

/**
 * Calcula líneas conectoras (simplificado para esta fase)
 */
function calculateConnectorLines(
  positions: MatchLayoutPosition[],
  config: BracketGridConfig
): ConnectorCalculationResult {
  const startTime = performance.now()
  
  // Para esta fase, retornamos estructura vacía
  // En FASE 3 implementaremos la lógica completa de conectores
  
  return {
    groups: [],
    lines: [],
    totalBounds: { x: 0, y: 0, width: 0, height: 0 },
    calculationTime: performance.now() - startTime
  }
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

/**
 * Hook principal para cálculo y gestión del layout del bracket
 */
export function useBracketLayout(
  bracketData: BracketData | null,
  options: UseBracketLayoutConfig = {}
): UseBracketLayoutResult {
  
  const {
    gridConfig: customGridConfig,
    autoRecalculate = true,
    recalculateDebounce = 300
  } = options
  
  // Referencias para performance
  const containerRef = useRef<HTMLDivElement>(null)
  const recalculateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Estados del hook
  const [layout, setLayout] = useState<BracketLayout | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [viewportInfo, setViewportInfo] = useState<ViewportInfo>({
    dimensions: { width: 1024, height: 768 },
    scroll: { x: 0, y: 0 },
    visibleArea: { x: 0, y: 0, width: 1024, height: 768 },
    zoomLevel: 1
  })
  
  // Configuración final
  const finalGridConfig = useMemo((): BracketGridConfig => ({
    ...DEFAULT_GRID_CONFIG,
    ...customGridConfig
  }), [customGridConfig])
  
  // Función para calcular layout completo
  const calculateLayout = useCallback(async (): Promise<void> => {
    if (!bracketData || bracketData.matches.length === 0) {
      setLayout(null)
      return
    }
    
    setCalculating(true)
    setError(null)
    
    try {
      const startTime = performance.now()
      
      // Calcular posiciones de matches
      const positionResult = calculateMatchPositions(
        bracketData.matches,
        finalGridConfig,
        viewportInfo
      )
      
      if (!positionResult.isValid) {
        throw new Error(`Position calculation failed: ${positionResult.errors.join(', ')}`)
      }
      
      // Calcular columnas de rounds
      const columns = calculateRoundColumns(positionResult.positions, finalGridConfig)
      
      // Calcular conectores
      const connectorResult = calculateConnectorLines(positionResult.positions, finalGridConfig)
      
      // Obtener configuración responsive activa
      const activeBreakpoint = getActiveResponsiveConfig(
        viewportInfo.dimensions.width,
        finalGridConfig.responsive
      )
      
      const totalCalculationTime = performance.now() - startTime
      
      // Crear layout completo
      const newLayout: BracketLayout = {
        totalDimensions: positionResult.totalDimensions,
        config: finalGridConfig,
        viewport: viewportInfo,
        columns,
        matchPositions: positionResult.positions,
        connectors: connectorResult.groups,
        metadata: {
          calculatedAt: new Date().toISOString(),
          calculationTime: totalCalculationTime,
          activeBreakpoint,
          isValid: true,
          warnings: positionResult.errors
        }
      }
      
      setLayout(newLayout)
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[useBracketLayout] Layout calculated:', {
          matches: positionResult.positions.length,
          columns: columns.length,
          dimensions: positionResult.totalDimensions,
          calculationTime: totalCalculationTime.toFixed(2) + 'ms'
        })
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown layout calculation error'
      setError(new Error(errorMessage))
      console.error('[useBracketLayout] Layout calculation error:', err)
    } finally {
      setCalculating(false)
    }
  }, [bracketData, finalGridConfig, viewportInfo])
  
  // Función para recalcular con debounce
  const recalculate = useCallback(() => {
    if (recalculateTimeoutRef.current) {
      clearTimeout(recalculateTimeoutRef.current)
    }
    
    recalculateTimeoutRef.current = setTimeout(() => {
      calculateLayout()
    }, recalculateDebounce)
  }, [calculateLayout, recalculateDebounce])
  
  // Función para scroll a match específico
  const scrollToMatch = useCallback((matchId: string) => {
    if (!layout || !containerRef.current) return
    
    const matchPosition = layout.matchPositions.find(p => p.match.id === matchId)
    if (!matchPosition) return
    
    const container = containerRef.current
    const { bounds } = matchPosition
    
    // Calcular posición de scroll para centrar el match
    const scrollX = bounds.x - (container.clientWidth / 2) + (bounds.width / 2)
    const scrollY = bounds.y - (container.clientHeight / 2) + (bounds.height / 2)
    
    container.scrollTo({
      left: Math.max(0, scrollX),
      top: Math.max(0, scrollY),
      behavior: 'smooth'
    })
  }, [layout])
  
  // Función para cambiar zoom
  const setZoom = useCallback((level: number) => {
    const clampedZoom = Math.max(0.5, Math.min(2, level))
    setViewportInfo(prev => ({
      ...prev,
      zoomLevel: clampedZoom
    }))
  }, [])
  
  // Efecto para actualizar viewport info
  useEffect(() => {
    const updateViewportInfo = () => {
      if (!containerRef.current) return
      
      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      
      setViewportInfo(prev => ({
        ...prev,
        dimensions: { width: rect.width, height: rect.height },
        scroll: { x: container.scrollLeft, y: container.scrollTop },
        visibleArea: {
          x: container.scrollLeft,
          y: container.scrollTop,
          width: rect.width,
          height: rect.height
        }
      }))
    }
    
    // Initial update
    updateViewportInfo()
    
    // Listeners para cambios
    const handleResize = () => {
      updateViewportInfo()
      if (autoRecalculate) {
        recalculate()
      }
    }
    
    const handleScroll = () => {
      updateViewportInfo()
    }
    
    window.addEventListener('resize', handleResize)
    containerRef.current?.addEventListener('scroll', handleScroll)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      containerRef.current?.removeEventListener('scroll', handleScroll)
    }
  }, [autoRecalculate, recalculate])
  
  // Efecto para recalcular cuando cambian los datos
  useEffect(() => {
    if (bracketData) {
      calculateLayout()
    }
  }, [calculateLayout])
  
  // Cleanup en unmount
  useEffect(() => {
    return () => {
      if (recalculateTimeoutRef.current) {
        clearTimeout(recalculateTimeoutRef.current)
      }
    }
  }, [])
  
  return {
    layout,
    calculating,
    error,
    recalculate,
    scrollToMatch,
    setZoom,
    config: finalGridConfig
  }
}

export default useBracketLayout