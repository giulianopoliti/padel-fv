/**
 * IMPROVED BRACKET RENDERER - VERSIÓN MEJORADA Y MÁS CLARA
 * 
 * Renderizador de brackets con visualización mejorada, gestión de matches
 * y componentes de gestión integrados.
 * 
 * MEJORAS:
 * - Visualización más clara y organizada
 * - Integración con MatchManagementCard
 * - Layout responsive mejorado
 * - Estados visuales más claros
 * - Drag & drop optimizado
 * 
 * @author Claude Code Assistant
 * @version 3.0.0
 */

'use client'

import React, { useMemo, useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  Grid, 
  List, 
  Maximize2, 
  Minimize2, 
  Zap, 
  Users,
  Trophy,
  Clock,
  Filter,
  Edit3,
  Save,
  X
} from 'lucide-react'
import { MatchManagementCard } from './MatchManagementCard'
import { DraggableMatchManagementCard } from './DraggableMatchManagementCard'
import { GranularMatchCard } from './GranularMatchCard'
import { ImprovedMatchResultForm } from './ImprovedMatchResultForm'
import { useBracketLayout } from '../hooks/useBracketLayout'
import { useBracketDragDrop } from '../context/bracket-drag-context'
import { useBracketDragOperations } from '../hooks/useBracketDragOperations'
import { applyPendingOperationsToData, getMatchPreviewInfo } from '../utils/preview-operations'
import type {
  BracketData,
  BracketMatchV2,
  ParticipantSlot,
  CoupleData
} from '../types/bracket-types'
import type { DragDropConfig, SlotPosition } from '../types/drag-drop-types'

// ============================================================================
// TIPOS
// ============================================================================

export interface ImprovedBracketRendererProps {
  bracketData: BracketData
  tournamentId: string
  tournamentType?: 'AMERICAN' | 'LONG'  // ✅ NUEVO
  isOwner?: boolean
  enableDragDrop?: boolean
  onMatchUpdate?: (matchId: string, updatedData: any) => void
  onDataRefresh?: () => void
  className?: string
}

interface RoundGroup {
  round: string
  matches: BracketMatchV2[]
  displayName: string
  totalMatches: number
  completedMatches: number
  canPlay: number  // Matches que pueden jugarse (tienen ambas parejas)
}

interface ViewMode {
  layout: 'grid' | 'list'
  compact: boolean
  showCompleted: boolean
  filterByStatus?: string
}

// ============================================================================
// CONSTANTES
// ============================================================================

// Nombres cortos para tabs (optimizar espacio)
const SHORT_ROUND_NAMES: Record<string, string> = {
  '32VOS': '32vos',
  '16VOS': '16vos',
  '8VOS': '8vos',
  '4TOS': '4tos',
  'SEMIFINAL': 'Semis',
  'FINAL': 'Final'
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function ImprovedBracketRenderer({
  bracketData,
  tournamentId,
  tournamentType = 'AMERICAN',  // ✅ DEFAULT AMERICAN
  isOwner = false,
  enableDragDrop = false,
  onMatchUpdate,
  onDataRefresh,
  className
}: ImprovedBracketRendererProps) {

  // Estados locales
  const [viewMode, setViewMode] = useState<ViewMode>({
    layout: 'grid',
    compact: false,
    showCompleted: true
  })
  const [selectedRound, setSelectedRound] = useState<string>('all')
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState<boolean>(false)
  const { toast } = useToast()

  // Hook del contexto de drag & drop para obtener operaciones pendientes
  const { state: dragState, actions: dragActions } = useBracketDragDrop()
  
  // Hook para operaciones de drag & drop (guardar, cancelar)
  const dragOperations = useBracketDragOperations({
    tournamentId,
    isOwner,
    config: {
      enabled: enableDragDrop && isOwner && isEditMode,
      sameRoundOnly: true,
      pendingMatchesOnly: true,
      maxPendingOperations: 10
    }
  })
  
  // ✅ FIXED: Stabilize preview data calculation with deep comparison
  const previewData = useMemo(() => {
    // Only recalculate if there are actual pending operations or bracket data changed
    if (dragState.pendingOperations.length === 0) {
      return bracketData; // No operations pending, return original data
    }
    return applyPendingOperationsToData(bracketData, dragState.pendingOperations);
  }, [
    bracketData.matches.length, // ✅ Use length instead of full array
    bracketData.seeds.length,   // ✅ Use length instead of full array  
    dragState.pendingOperations.length, // ✅ Use length for comparison
    // ✅ Add operation IDs for deep change detection
    dragState.pendingOperations.map(op => op.operationId).join(',')
  ])

  // Agrupar matches por round (usando preview data)
  const roundGroups = useMemo(() => {
    // ✅ FIXED: Only log in development and reduce frequency
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 [ImprovedBracketRenderer] Recalculando roundGroups:`, {
        previewMatches: previewData.matches.length,
        pendingOperations: dragState.pendingOperations.length
      })
    }
    
    // ✅ FIXED: Only check for duplicates in development
    if (process.env.NODE_ENV === 'development') {
      const matchIds = previewData.matches.map(m => m.id)
      const uniqueIds = new Set(matchIds)
      if (matchIds.length !== uniqueIds.size) {
        console.error(`❌ [ImprovedBracketRenderer] MATCHES DUPLICADOS DETECTADOS:`, {
          totalMatches: matchIds.length,
          uniqueIds: uniqueIds.size
        })
      }
    }
    
    const groups = new Map<string, BracketMatchV2[]>()
    
    previewData.matches.forEach(match => {
      if (!groups.has(match.round)) {
        groups.set(match.round, [])
      }
      groups.get(match.round)!.push(match)
    })

    // Convertir a array con estadísticas - Orden cronológico del torneo
    const roundOrder = ['32VOS', '16VOS', '8VOS', '4TOS', 'SEMIFINAL', 'FINAL']
    const roundDisplayNames: Record<string, string> = {
      '8VOS': 'Octavos de Final',
      '4TOS': 'Cuartos de Final',
      'SEMIFINAL': 'Semifinales',
      'FINAL': 'Final',
      '16VOS': 'Dieciseisavos',
      '32VOS': 'Treintaidosavos'
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => {
        const indexA = roundOrder.indexOf(a)
        const indexB = roundOrder.indexOf(b)
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
      })
      .map(([round, matches]): RoundGroup => {
        const sortedMatches = matches.sort((a, b) => (a.order_in_round || 0) - (b.order_in_round || 0))
        const completedMatches = sortedMatches.filter(m => m.status === 'FINISHED').length
        const canPlay = sortedMatches.filter(m => 
          m.participants?.slot1?.couple && m.participants?.slot2?.couple
        ).length

        return {
          round,
          matches: sortedMatches,
          displayName: roundDisplayNames[round] || round,
          totalMatches: sortedMatches.length,
          completedMatches,
          canPlay
        }
      })
  }, [previewData.matches])

  // Estadísticas generales (usando preview data)
  const stats = useMemo(() => {
    const total = previewData.matches.length
    const completed = previewData.matches.filter(m => m.status === 'FINISHED').length
    const inProgress = previewData.matches.filter(m => m.status === 'IN_PROGRESS').length
    const canPlay = previewData.matches.filter(m => 
      m.participants?.slot1?.couple && m.participants?.slot2?.couple && m.status === 'PENDING'
    ).length

    return { total, completed, inProgress, canPlay }
  }, [previewData.matches])

  // Filtrar matches según configuración
  const filteredRounds = useMemo(() => {
    let filtered = roundGroups

    if (selectedRound !== 'all') {
      filtered = filtered.filter(group => group.round === selectedRound)
    }

    if (!viewMode.showCompleted) {
      filtered = filtered.map(group => ({
        ...group,
        matches: group.matches.filter(m => m.status !== 'FINISHED')
      })).filter(group => group.matches.length > 0)
    }

    return filtered
  }, [roundGroups, selectedRound, viewMode.showCompleted])

  // Handlers de modo edición
  const handleEnterEditMode = () => {
    setIsEditMode(true)
  }

  const handleExitEditMode = () => {
    // Limpiar operaciones pendientes al salir
    dragOperations.clearPendingOperations()
    setIsEditMode(false)
  }

  const handleSaveChanges = async () => {
    if (dragState.pendingOperations.length === 0) return
    
    const result = await dragOperations.saveAllOperations()
    if (result.success) {
      setIsEditMode(false)
      onDataRefresh?.()
    }
  }


  // Renderizar match individual con nuevo sistema granular
  const renderMatch = (match: BracketMatchV2, index: number) => {
    const isExpanded = expandedMatch === match.id
    
    // Información de preview para este match
    const previewInfo = getMatchPreviewInfo(match.id, dragState.pendingOperations)
    const hasChanges = previewInfo.hasChanges
    
    // ✅ FIXED: Reduce excessive logging - only in development and only for errors
    if (process.env.NODE_ENV === 'development' && hasChanges) {
      console.log(`🎯 [ImprovedBracketRenderer] Match with changes:`, {
        matchId: match.id,
        round: match.round
      })
    }
    
    // Handler para carga de resultados (ya no se usa - el formulario es inline)
    const handleResultClick = (matchData: BracketMatchV2) => {
      console.log('🎯 [ImprovedBracketRenderer] Click en resultado (inline form handles this)')
      // Ya no expandimos - el GranularMatchCard maneja esto inline
    }

    return (
      <div
        key={match.id}
        className={cn(
          'transition-all duration-200 relative',
          isExpanded && 'scale-105 z-10 relative shadow-lg',
          hasChanges && 'ring-2 ring-blue-300 ring-opacity-50 shadow-blue-100'
        )}
      >
        {/* Indicador de cambios pendientes */}
        {hasChanges && (
          <div className="absolute -top-2 -right-2 z-30">
            <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg">
              {previewInfo.operationsCount}
            </div>
          </div>
        )}
        
        {/* Componente granular con drag & drop preciso */}
        <GranularMatchCard
          match={match}
          tournamentId={tournamentId}
          tournamentType={tournamentType}  // ✅ NUEVO
          isOwner={isOwner}
          isEditMode={isEditMode}
          seeds={bracketData.seeds}  // ✅ NUEVO: Pasar seeds para resolver couple IDs
          onMatchUpdate={onMatchUpdate}
          onResultClick={handleResultClick}
          className={cn(
            'hover:shadow-md transition-shadow',
            viewMode.compact && 'text-sm',
            hasChanges && 'ring-1 ring-blue-200 shadow-blue-50'
          )}
        />
        
        {/* Ya no usamos panel expandido - todo es inline en las cards */}
      </div>
    )
  }

  // Renderizar grid de round
  const renderRoundGrid = (group: RoundGroup) => {
    return (
      <div className="space-y-4">
        {/* Header del round */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {group.displayName}
            </h3>
          </div>
          
          {/* Badge de progreso */}
          <Badge 
            variant={group.completedMatches === group.totalMatches ? "default" : "secondary"}
            className={cn(
              group.completedMatches === group.totalMatches && "bg-green-600"
            )}
          >
            {group.completedMatches}/{group.totalMatches}
          </Badge>
        </div>

        {/* Grid de matches */}
        <div className={cn(
          'grid gap-4',
          viewMode.layout === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'
        )}>
          {group.matches.map((match, index) => renderMatch(match, index))}
        </div>
      </div>
    )
  }

  // Renderizar controles
  const renderControls = () => (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white border-b">
      
      {/* Botón de modo edición y controles */}
      {isOwner && enableDragDrop && (
        <div className="flex items-center gap-3">
          {!isEditMode ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleEnterEditMode}
                    variant="outline"
                    size="sm"
                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    🔄 Reorganizar Parejas
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Arrastra parejas de un partido a otro para modificar la llave</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div className="flex items-center gap-2">
              {dragState.pendingOperations.length > 0 ? (
                <>
                  <Button
                    onClick={handleSaveChanges}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Guardar {dragState.pendingOperations.length} cambio(s)
                  </Button>
                  <Button
                    onClick={handleExitEditMode}
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleExitEditMode}
                  variant="outline"
                  size="sm"
                  className="border-gray-300"
                >
                  <X className="h-4 w-4 mr-2" />
                  ✅ Editando Llave
                </Button>
              )}
            </div>
          )}
        </div>
      )}


      {/* Indicador de operaciones pendientes */}
      {dragState.pendingOperations.length > 0 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-blue-800 font-medium">
            {dragState.pendingOperations.length} intercambio(s) pendiente(s)
          </span>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            No guardado
          </Badge>
        </div>
      )}
    
    <div className="flex-1 flex flex-wrap items-center justify-end gap-4">

      {/* Controles de vista */}
      <div className="flex items-center gap-2">
        {/* Filtro por round */}
        <select
          value={selectedRound}
          onChange={(e) => setSelectedRound(e.target.value)}
          className="px-3 py-1 border rounded text-sm"
        >
          <option value="all">Todas las rondas</option>
          {roundGroups.map(group => (
            <option key={group.round} value={group.round}>
              {group.displayName}
            </option>
          ))}
        </select>

        {/* Toggle layout */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setViewMode(prev => ({ 
            ...prev, 
            layout: prev.layout === 'grid' ? 'list' : 'grid' 
          }))}
        >
          {viewMode.layout === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
        </Button>

        {/* Toggle compacto */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setViewMode(prev => ({ ...prev, compact: !prev.compact }))}
        >
          {viewMode.compact ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
        </Button>

      </div>
    </div>
    </div>
  )

  return (
    <div className={cn('bg-gray-50 rounded-lg border', className)}>
      {/* Controles superiores */}
      {renderControls()}

      {/* Contenido principal */}
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="p-6 space-y-8">
          {/* Tabs por round para mejor organización */}
          <Tabs value={selectedRound} onValueChange={setSelectedRound}>
            <ScrollArea className="w-full">
              <TabsList className="inline-flex w-max min-w-full">
                <TabsTrigger value="all" className="min-w-[100px]">Todas</TabsTrigger>
                {roundGroups.map(group => (
                  <TabsTrigger
                    key={group.round}
                    value={group.round}
                    className="min-w-[100px]"
                  >
                    {SHORT_ROUND_NAMES[group.round] || group.round}
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            <TabsContent value="all" className="space-y-8 mt-6">
              {filteredRounds.map(group => (
                <div key={group.round}>
                  {renderRoundGrid(group)}
                </div>
              ))}
            </TabsContent>

            {roundGroups.map(group => (
              <TabsContent key={group.round} value={group.round} className="mt-6">
                {renderRoundGrid(group)}
              </TabsContent>
            ))}
          </Tabs>

          {/* Mensaje si no hay matches */}
          {filteredRounds.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500 text-lg">
                No hay matches para mostrar
              </div>
              <div className="text-gray-400 text-sm mt-2">
                Ajusta los filtros o verifica que el bracket esté generado
              </div>
            </div>
          )}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>

      {/* Información de drag & drop según modo */}
      {enableDragDrop && isOwner && (
        <div className={cn(
          "p-3 border-t transition-colors",
          isEditMode ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {isEditMode ? (
                <>
                  <Zap className="h-4 w-4 text-blue-600" />
                  <span className="text-blue-800">
                    <strong>Modo Edición Activo:</strong> Arrastra parejas entre matches de la misma ronda
                  </span>
                </>
              ) : (
                <>
                  <Edit3 className="h-4 w-4 text-gray-600" />
                  <span className="text-gray-700">
                    Drag & Drop disponible. Toca "Modo Edición" para reorganizar parejas
                  </span>
                </>
              )}
            </div>
            {isEditMode && dragState.pendingOperations.length > 0 && (
              <div className="text-xs text-blue-600">
                {dragState.pendingOperations.length} operación(es) pendiente(s) • 
                <span className="font-medium"> Toca "Guardar" para aplicar</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}