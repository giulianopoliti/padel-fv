/**
 * GRANULAR MATCH CARD - MATCH CON DRAG & DROP GRANULAR
 * 
 * Match card que usa DraggableCoupleSlot para permitir drag & drop
 * preciso de parejas individuales entre matches.
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 * @created 2025-01-19
 */

'use client'

import React, { useState, useEffect } from 'react'
import { mutate } from 'swr'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Trophy,
  Clock,
  MapPin,
  Edit3,
  Zap,
  Play
} from 'lucide-react'
import { DraggableCoupleSlot } from './DraggableCoupleSlot'
import { useBracketDragOperations } from '../hooks/useBracketDragOperations'
import { useBracketDragDrop } from '../context/bracket-drag-context'
import { InlineResultForm } from './InlineResultForm'
import { ModifyResultForm } from './ModifyResultForm'
import { useMatchManagement } from '../hooks/useMatchManagement'
import ThreeSetResultDisplay from '../../universal/ThreeSetResultDisplay'
import LoadMatchResultDialog from '../../../../app/(main)/tournaments/[id]/match-scheduling/components/LoadMatchResultDialog'
import { ByeActionsDropdown } from './ByeActionsDropdown'
import { ZoneConflictBadge } from './ZoneConflictBadge'
import { useZoneMatchHistory, havePlayedInZone } from '../hooks/useZoneMatchHistory'
import { resolveCoupleIds } from '../utils/couple-resolver'
import type {
  BracketMatchV2,
  CoupleData,
  SeedInfo
} from '../types/bracket-types'

// ============================================================================
// TIPOS
// ============================================================================

export interface GranularMatchCardProps {
  /** Match data */
  match: BracketMatchV2
  /** Tournament ID */
  tournamentId: string
  /** Tournament type - determines UI behavior */
  tournamentType?: 'AMERICAN' | 'LONG'
  /** Si es owner */
  isOwner: boolean
  /** Si está en modo edición */
  isEditMode: boolean
  /** Seeds del torneo (para resolver couple IDs) */
  seeds?: SeedInfo[]
  /** Handler para updates */
  onMatchUpdate?: (matchId: string, updatedData: any) => void
  /** Handler para click en resultado */
  onResultClick?: (match: BracketMatchV2) => void
  /** Clase CSS */
  className?: string
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function GranularMatchCard({
  match,
  tournamentId,
  tournamentType = 'AMERICAN',  // ✅ DEFAULT AMERICAN
  isOwner,
  isEditMode,
  seeds = [],
  onMatchUpdate,
  onResultClick,
  className
}: GranularMatchCardProps) {

  // DEBUG: Placeholder data successfully integrated via V2 architecture

  // Estados locales
  const [localDragHover, setLocalDragHover] = useState<'slot1' | 'slot2' | null>(null)
  const [showInlineResult, setShowInlineResult] = useState<boolean>(false)
  const [showModifyResult, setShowModifyResult] = useState<boolean>(false)
  const [showLoadMatchDialog, setShowLoadMatchDialog] = useState<boolean>(false)
  // ✅ NUEVOS ESTADOS PARA ASIGNACIÓN DE CANCHA
  const [courtNumber, setCourtNumber] = useState<string>(match.scheduling?.court || '')
  const [isAssigningCourt, setIsAssigningCourt] = useState<boolean>(false)

  // ✅ DETERMINAR FORMATO DE RESULTADO
  const isLongTournament = tournamentType === 'LONG'

  // ✅ HOOK DE MATCH MANAGEMENT UNIFICADO
  const [matchState, matchActions] = useMatchManagement(
    tournamentId,
    onMatchUpdate,
    (error) => console.error('Match management error:', error)
  )

  // Hooks de drag & drop
  const { state: dragState, actions: dragActions } = useBracketDragDrop()
  const dragOperations = useBracketDragOperations({
    tournamentId,
    isOwner,
    config: {
      enabled: isEditMode && isOwner,
      sameRoundOnly: true,
      pendingMatchesOnly: true,
      maxPendingOperations: 10
    }
  })

  // Datos de parejas
  const couple1 = match.participants?.slot1?.couple || null
  const couple2 = match.participants?.slot2?.couple || null

  // ============================================================================
  // ✨ NUEVO: DETECCIÓN DE CONFLICTOS DE ZONA
  // ============================================================================

  // Hook para obtener historial de matches de zona
  const { history: zoneHistory, isLoading: isLoadingHistory } = useZoneMatchHistory(tournamentId)

  // Resolver couple IDs del match actual
  const { couple1Id, couple2Id, bothDefined } = resolveCoupleIds(match, seeds)

  // Verificar si ya jugaron en zonas
  const hasZoneConflict = bothDefined && havePlayedInZone(zoneHistory, couple1Id, couple2Id)

  // Obtener nombres de parejas para el badge
  const couple1Name = couple1?.name ||
    (couple1?.player1_details && couple1?.player2_details
      ? `${couple1.player1_details.first_name} ${couple1.player1_details.last_name} / ${couple1.player2_details.first_name} ${couple1.player2_details.last_name}`
      : null)

  const couple2Name = couple2?.name ||
    (couple2?.player1_details && couple2?.player2_details
      ? `${couple2.player1_details.first_name} ${couple2.player1_details.last_name} / ${couple2.player2_details.first_name} ${couple2.player2_details.last_name}`
      : null)

  // Estados de cada slot
  const slot1IsDragging = dragState.draggedItem?.sourceMatchId === match.id && 
                         dragState.draggedItem?.sourceSlot === 'slot1'
  const slot2IsDragging = dragState.draggedItem?.sourceMatchId === match.id && 
                         dragState.draggedItem?.sourceSlot === 'slot2'

  // Estado de modificación
  const canModifyResult = match.status === 'FINISHED' &&
                         match.participants?.slot1?.couple &&
                         match.participants?.slot2?.couple &&
                         !isEditMode

  // ✅ SINCRONIZAR courtNumber CON DATOS DEL MATCH
  useEffect(() => {
    const matchCourt = match.scheduling?.court
    if (matchCourt && matchCourt !== courtNumber) {
      setCourtNumber(matchCourt)
    }
  }, [match.scheduling?.court, courtNumber])

  // ============================================================================
  // VALIDACIONES
  // ============================================================================

  const canDragSlot1 = isEditMode && isOwner && !!couple1 && match.status === 'PENDING'
  const canDragSlot2 = isEditMode && isOwner && !!couple2 && match.status === 'PENDING'
  
  const canReceiveDropSlot1 = isEditMode && isOwner && match.status === 'PENDING' &&
                              dragState.isDragging && dragState.draggedItem &&
                              !(dragState.draggedItem.sourceMatchId === match.id && dragState.draggedItem.sourceSlot === 'slot1')
  
  const canReceiveDropSlot2 = isEditMode && isOwner && match.status === 'PENDING' &&
                              dragState.isDragging && dragState.draggedItem &&
                              !(dragState.draggedItem.sourceMatchId === match.id && dragState.draggedItem.sourceSlot === 'slot2')

  // ============================================================================
  // HANDLERS DE DRAG & DROP
  // ============================================================================

  const handleDragStart = (couple: CoupleData, matchData: BracketMatchV2, slot: 'slot1' | 'slot2') => {
    console.log(`🎯 [GranularMatchCard] Iniciando drag:`, {
      couple: couple.id,
      match: matchData.id,
      slot,
      round: matchData.round
    })
    
    dragOperations.startDrag(couple, matchData, slot)
  }

  const handleDragEnd = () => {
    console.log(`🏁 [GranularMatchCard] Terminando drag`)
    dragOperations.endDrag()
    setLocalDragHover(null)
  }

  const handleDragEnter = (targetMatch: BracketMatchV2, targetSlot: 'slot1' | 'slot2') => {
    if (targetMatch.id === match.id) {
      setLocalDragHover(targetSlot)
    }
  }

  const handleDragLeave = () => {
    setLocalDragHover(null)
  }

  const handleDrop = (targetMatch: BracketMatchV2, targetSlot: 'slot1' | 'slot2') => {
    console.log(`🎯 [GranularMatchCard] Drop en:`, {
      targetMatch: targetMatch.id,
      targetSlot,
      draggedItem: dragState.draggedItem,
      targetRound: targetMatch.round
    })
    
    if (dragState.draggedItem) {
      // Validar que es misma ronda
      if (dragState.draggedItem.sourceRound !== targetMatch.round) {
        console.log(`❌ [GranularMatchCard] Drop cancelado: diferentes rondas`, {
          sourceRound: dragState.draggedItem.sourceRound,
          targetRound: targetMatch.round
        })
        return
      }
      
      // Validar que ambos matches están pendientes
      if (targetMatch.status !== 'PENDING') {
        console.log(`❌ [GranularMatchCard] Drop cancelado: match destino no pendiente`)
        return
      }
      
      console.log(`✅ [GranularMatchCard] Drop válido - procesando...`)
      dragOperations.handleDrop(targetMatch, targetSlot)
    }
    
    setLocalDragHover(null)
  }

  // ============================================================================
  // HANDLERS DE CLICKS
  // ============================================================================

  const handleCoupleClick = (couple: CoupleData | null, matchData: BracketMatchV2, slot: 'slot1' | 'slot2') => {
    // En modo normal, no hacer nada al clickear la pareja
    // Solo permitir drag en modo edición
    if (isEditMode) {
      console.log('🎯 [GranularMatchCard] Click en pareja en modo edición - drag disponible')
    }
  }

  // ✅ BOTÓN CONDICIONAL SEGÚN TIPO DE TORNEO
  const handleResultButtonClick = () => {
    if (isLongTournament) {
      setShowLoadMatchDialog(true)  // LoadMatchResultDialog para torneos largos
    } else {
      setShowInlineResult(true)     // InlineResultForm para torneos americanos
    }
  }

  const handleInlineResultSaved = (matchId: string, result: any) => {
    console.log('🎯 [GranularMatchCard] Resultado inline guardado:', { matchId, result })
    setShowInlineResult(false)

    // ✅ INVALIDAR CACHE SWR TAMBIÉN PARA TORNEOS AMERICANOS
    mutate(`/api/tournaments/${tournamentId}/matches`)
    mutate(`tournament-sidebar-${tournamentId}`)
    mutate(`/api/tournaments/${tournamentId}/seeds`)

    console.log('🔄 [GranularMatchCard] Cache SWR invalidado para torneo americano:', {
      matches: `/api/tournaments/${tournamentId}/matches`,
      sidebar: `tournament-sidebar-${tournamentId}`,
      seeds: `/api/tournaments/${tournamentId}/seeds`
    })

    if (onMatchUpdate) {
      onMatchUpdate(matchId, { result, status: 'FINISHED' })
    }
  }

  const handleInlineResultCancel = () => {
    setShowInlineResult(false)
  }

  // ✅ HANDLERS PARA LOADMATCHRESULTDIALOG (TORNEOS LARGOS)
  const handleLoadMatchResultSaved = () => {
    console.log('🎯 [GranularMatchCard] Resultado de 3 sets guardado - INICIANDO INVALIDACION')
    setShowLoadMatchDialog(false)

    // ✅ DEBUGGING: Log del tournamentId para verificar que existe
    console.log('🔍 [GranularMatchCard] Tournament ID para invalidación:', tournamentId)

    // ✅ SOLUCION COMPLETA: Invalidar todos los caches SWR relevantes
    const matchesKey = `/api/tournaments/${tournamentId}/matches`
    const sidebarKey = `tournament-sidebar-${tournamentId}`
    const seedsKey = `/api/tournaments/${tournamentId}/seeds`

    console.log('🔄 [GranularMatchCard] ANTES de mutate - Keys a invalidar:', {
      matches: matchesKey,
      sidebar: sidebarKey,
      seeds: seedsKey
    })

    // Invalidar con logging de resultados
    mutate(matchesKey).then(() => {
      console.log('✅ [GranularMatchCard] MUTATE MATCHES COMPLETADO')
    }).catch(err => {
      console.error('❌ [GranularMatchCard] ERROR EN MUTATE MATCHES:', err)
    })

    mutate(sidebarKey).then(() => {
      console.log('✅ [GranularMatchCard] MUTATE SIDEBAR COMPLETADO')
    }).catch(err => {
      console.error('❌ [GranularMatchCard] ERROR EN MUTATE SIDEBAR:', err)
    })

    mutate(seedsKey).then(() => {
      console.log('✅ [GranularMatchCard] MUTATE SEEDS COMPLETADO')
    }).catch(err => {
      console.error('❌ [GranularMatchCard] ERROR EN MUTATE SEEDS:', err)
    })

    // ✅ SOLUCIÓN DE EMERGENCIA: Invalidar TODOS los caches relacionados con este torneo
    console.log('🚨 [GranularMatchCard] SOLUCIÓN DE EMERGENCIA: Invalidando todos los caches del torneo')
    mutate(
      key => typeof key === 'string' && key.includes(tournamentId),
      undefined,
      { revalidate: true }
    ).then(() => {
      console.log('✅ [GranularMatchCard] INVALIDACIÓN MASIVA COMPLETADA')
    }).catch(err => {
      console.error('❌ [GranularMatchCard] ERROR EN INVALIDACIÓN MASIVA:', err)
    })

    console.log('🔄 [GranularMatchCard] DESPUÉS de mutate - Cache SWR invalidado para:', {
      matches: matchesKey,
      sidebar: sidebarKey,
      seeds: seedsKey
    })

    // También triggear refetch del hook personalizado si está disponible
    if (onMatchUpdate) {
      console.log('🔄 [GranularMatchCard] Llamando onMatchUpdate también')
      onMatchUpdate(match.id, { status: 'FINISHED' })
    } else {
      console.log('⚠️ [GranularMatchCard] onMatchUpdate NO está disponible')
    }
  }

  // ✅ BRIDGE FUNCTION PARA CONECTAR LOADMATCHRESULTDIALOG CON USEMATCHMANAGEMENT
  const createBridgeFunction = () => {
    return async (
      matchId: string,
      sets: any[], // SetResult[] del LoadMatchResultDialog
      winnerId: string,
      resultCouple1: string,
      resultCouple2: string
    ): Promise<{success: boolean, error?: string}> => {

      // ✅ CONVERTIR SetResult[] → MatchResult unified
      const matchSets = sets.map(set => ({
        couple1_games: set.couple1_games,
        couple2_games: set.couple2_games
      }))

      // ✅ USAR HOOK UNIFICADO
      const result = matchActions.createBestOf3Result(matchSets, winnerId)
      const success = await matchActions.updateResult(matchId, result, true)

      // ✅ NOTIFICAR ACTUALIZACIÓN SI ES EXITOSA
      if (success && onMatchUpdate) {
        onMatchUpdate(matchId, {
          result,
          status: 'FINISHED',
          result_couple1: resultCouple1,
          result_couple2: resultCouple2
        })
      }

      return { success, error: success ? undefined : matchState.error }
    }
  }

  // ✅ FUNCIÓN PARA ADAPTAR MATCH A FORMATO ESPERADO POR LOADMATCHRESULTDIALOG
  const adaptMatchForDialog = (match: BracketMatchV2) => {
    return {
      id: match.id,
      couple1_id: couple1?.id || '',
      couple2_id: couple2?.id || '',
      couple1: couple1 ? {
        player1: couple1.player1_details,
        player2: couple1.player2_details
      } : null,
      couple2: couple2 ? {
        player1: couple2.player1_details,
        player2: couple2.player2_details
      } : null
    }
  }

  const handleModifyResultClick = () => {
    console.log('🔄 [GranularMatchCard] Iniciando modificación de resultado para match:', match.id)

    if (isLongTournament) {
      // Para torneos largos (3 sets), usar LoadMatchResultDialog
      setShowLoadMatchDialog(true)
    } else {
      // Para torneos americanos (1 set), usar ModifyResultForm
      setShowModifyResult(true)
    }
  }

  const handleModifyResultSaved = (matchId: string, result: any) => {
    console.log('🔄 [GranularMatchCard] Resultado modificado:', { matchId, result })
    setShowModifyResult(false)
    setShowLoadMatchDialog(false)

    // ✅ INVALIDAR CACHE SWR PARA MODIFICACIONES
    mutate(`/api/tournaments/${tournamentId}/matches`)
    mutate(`tournament-sidebar-${tournamentId}`)
    mutate(`/api/tournaments/${tournamentId}/seeds`)

    console.log('🔄 [GranularMatchCard] Cache SWR invalidado para modificación:', {
      matches: `/api/tournaments/${tournamentId}/matches`,
      sidebar: `tournament-sidebar-${tournamentId}`,
      seeds: `/api/tournaments/${tournamentId}/seeds`
    })

    if (onMatchUpdate) {
      onMatchUpdate(matchId, { result, status: 'FINISHED' })
    }
  }

  const handleModifyResultCancel = () => {
    setShowModifyResult(false)
    setShowLoadMatchDialog(false)
  }

  // ✅ NUEVO HANDLER: Completar acción de BYE
  const handleByeActionComplete = () => {
    console.log('🔄 [GranularMatchCard] BYE action completed - invalidating cache')

    // Invalidar cache SWR (misma lógica que handleLoadMatchResultSaved)
    mutate(`/api/tournaments/${tournamentId}/matches`)
    mutate(`tournament-sidebar-${tournamentId}`)
    mutate(`/api/tournaments/${tournamentId}/seeds`)

    // Invalidación masiva como fallback
    mutate(
      key => typeof key === 'string' && key.includes(tournamentId),
      undefined,
      { revalidate: true }
    )

    console.log('🔄 [GranularMatchCard] Cache invalidated after BYE action')

    // Notificar al padre si existe
    if (onMatchUpdate) {
      onMatchUpdate(match.id, { status: match.status })
    }
  }

  // ✅ NUEVO HANDLER: Asignar cancha e iniciar partido
  const handleStartMatch = async () => {
    if (!courtNumber.trim()) {
      console.error('❌ [GranularMatchCard] Cancha no especificada')
      return
    }

    if (!couple1 || !couple2) {
      console.error('❌ [GranularMatchCard] Ambas parejas deben estar presentes')
      return
    }

    setIsAssigningCourt(true)

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/matches/${match.id}/assign-court`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          court: courtNumber.trim(),
          startMatch: true // ✅ CLAVE: Esto cambia el estado a IN_PROGRESS
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.success) {
        console.log('✅ [GranularMatchCard] Partido iniciado:', result)

        // Invalidar cache SWR
        mutate(`/api/tournaments/${tournamentId}/matches`)
        mutate(`tournament-sidebar-${tournamentId}`)

        // Notificar al padre
        if (onMatchUpdate) {
          onMatchUpdate(match.id, {
            court: result.court,
            status: result.status
          })
        }
      } else {
        console.error('❌ [GranularMatchCard] Error al iniciar partido:', result.error)
      }
    } catch (error) {
      console.error('❌ [GranularMatchCard] Error al asignar cancha:', error)
    } finally {
      setIsAssigningCourt(false)
    }
  }

  // ============================================================================
  // ESTADO VISUAL DEL MATCH
  // ============================================================================

  const getMatchStatusInfo = () => {
    switch (match.status) {
      case 'PENDING':
        return {
          badge: <Badge variant="secondary">Pendiente</Badge>,
          borderColor: 'border-gray-300',
          canAddResult: !!(couple1 && couple2)
        }
      case 'IN_PROGRESS':
        return {
          badge: <Badge variant="default" className="bg-blue-600">En Curso</Badge>,
          borderColor: 'border-blue-400',
          canAddResult: true
        }
      case 'FINISHED':
        return {
          badge: <Badge variant="default" className="bg-green-600">Finalizado</Badge>,
          borderColor: 'border-green-400',
          canAddResult: false
        }
      case 'WAITING_OPONENT' as any:
        return {
          badge: <Badge variant="outline">Esperando</Badge>,
          borderColor: 'border-orange-300',
          canAddResult: false
        }
      default:
        return {
          badge: <Badge variant="secondary">{match.status}</Badge>,
          borderColor: 'border-gray-300',
          canAddResult: false
        }
    }
  }

  const statusInfo = getMatchStatusInfo()

  // ============================================================================
  // CLASES CSS DINÁMICAS
  // ============================================================================

  const cardClasses = cn(
    'transition-all duration-200',
    statusInfo.borderColor,
    
    // Estado de drag global
    dragState.isDragging && 'ring-2 ring-blue-300 ring-opacity-50',
    
    // Estado de edit mode
    isEditMode && 'shadow-md',
    
    className
  )

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Card className={cardClasses}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Trophy className="h-4 w-4 text-gray-600" />
            <span className="font-semibold text-sm">
              {match.round} - Match {match.order_in_round || 'N/A'}
            </span>
            {isEditMode && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                <Zap className="h-3 w-3 mr-1" />
                Edit Mode
              </Badge>
            )}
            {/* ✨ NUEVO: Badge de conflicto de zona */}
            {hasZoneConflict && !isLoadingHistory && (
              <ZoneConflictBadge
                couple1Name={couple1Name || undefined}
                couple2Name={couple2Name || undefined}
                variant="warning"
                size="sm"
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            {statusInfo.badge}
            {/* ✨ NUEVO: Dropdown de acciones de BYE */}
            {isOwner && !isEditMode && (
              <ByeActionsDropdown
                match={match}
                tournamentId={tournamentId}
                isOwner={isOwner}
                onActionComplete={handleByeActionComplete}
              />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Slot 1 - Pareja 1 */}
        <DraggableCoupleSlot
          couple={couple1}
          match={match}
          slotPosition="slot1"
          placeholderLabel={match.participants?.slot1?.placeholder?.display || null}
          isPlaceholder={match.participants?.slot1?.type === 'placeholder' || false}
          canDrag={canDragSlot1}
          isEditMode={isEditMode}
          isDragging={slot1IsDragging}
          canReceiveDrop={!!canReceiveDropSlot1}
          isDragHover={localDragHover === 'slot1'}
          result={match.result_couple1 as 'W' | 'L' | null}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleCoupleClick}
        />

        {/* Separador VS */}
        <div className="text-center">
          <div className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full inline-block">
            VS
          </div>
        </div>

        {/* Slot 2 - Pareja 2 */}
        <DraggableCoupleSlot
          couple={couple2}
          match={match}
          slotPosition="slot2"
          placeholderLabel={match.participants?.slot2?.placeholder?.display || null}
          isPlaceholder={match.participants?.slot2?.type === 'placeholder' || false}
          canDrag={canDragSlot2}
          isEditMode={isEditMode}
          isDragging={slot2IsDragging}
          canReceiveDrop={!!canReceiveDropSlot2}
          isDragHover={localDragHover === 'slot2'}
          result={match.result_couple2 as 'W' | 'L' | null}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleCoupleClick}
        />

        {/* Información adicional del match */}
        <div className="pt-2 border-t border-gray-100 space-y-2">
          {/* Cancha */}
          {(courtNumber || match.scheduling?.court) && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4" />
              <span>Cancha {courtNumber || match.scheduling?.court}</span>
            </div>
          )}

          {/* ✅ RESULTADO CONDICIONAL SEGÚN TIPO DE TORNEO */}
          {match.status === 'FINISHED' && (
            isLongTournament ? (
              <ThreeSetResultDisplay matchId={match.id} className="text-sm" />
            ) : (
              ((match as any).result?.final_score) && (
                <div className="flex items-center gap-2 text-sm">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium">Resultado: {(match as any).result?.final_score ?? '--'}</span>
                </div>
              )
            )
          )}

          {/* ✅ NUEVA SECCIÓN: Asignar cancha e iniciar partido (solo PENDING) */}
          {isOwner && !isEditMode && match.status === 'PENDING' && couple1 && couple2 && (
            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="N° de cancha"
                    value={courtNumber}
                    onChange={(e) => setCourtNumber(e.target.value)}
                    className="text-sm h-8"
                    disabled={isAssigningCourt}
                  />
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleStartMatch}
                  disabled={!courtNumber.trim() || isAssigningCourt}
                  className="bg-blue-600 hover:bg-blue-700 text-xs h-8"
                >
                  <Play className="h-3 w-3 mr-1" />
                  {isAssigningCourt ? 'Iniciando...' : 'Iniciar Partido'}
                </Button>
              </div>
            </div>
          )}

          {/* Acciones para owner */}
          {isOwner && !isEditMode && !showInlineResult && !showModifyResult && !showLoadMatchDialog && (
            <div className="flex gap-2 pt-2">
              {/* Botón para cargar resultado (matches IN_PROGRESS o PENDING con ambas parejas) */}
              {(match.status === 'IN_PROGRESS' || (match.status === 'PENDING' && couple1 && couple2)) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResultButtonClick}
                  className="text-xs"
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  {isLongTournament ? 'Cargar Resultado (3 sets)' : 'Cargar Resultado'}
                </Button>
              )}

              {/* Botón para modificar resultado (matches finalizados) */}
              {canModifyResult && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleModifyResultClick}
                  className="text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  Modificar Resultado
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Formulario inline de resultados */}
        {showInlineResult && isOwner && !isEditMode && (
          <InlineResultForm
            match={match}
            tournamentId={tournamentId}
            isOwner={isOwner}
            onResultSaved={handleInlineResultSaved}
            onCancel={handleInlineResultCancel}
            className="mt-3"
          />
        )}

        {/* Formulario de modificación de resultados */}
        {showModifyResult && isOwner && !isEditMode && (
          <ModifyResultForm
            match={match}
            tournamentId={tournamentId}
            isOwner={isOwner}
            onResultSaved={handleModifyResultSaved}
            onCancel={handleModifyResultCancel}
            className="mt-3"
          />
        )}

        {/* ✅ LOADMATCHRESULTDIALOG PARA TORNEOS LARGOS */}
        {showLoadMatchDialog && isLongTournament && isOwner && (
          <LoadMatchResultDialog
            match={adaptMatchForDialog(match)}
            open={showLoadMatchDialog}
            onOpenChange={(open) => !open && setShowLoadMatchDialog(false)}
            onResultSaved={handleLoadMatchResultSaved}
            onUpdateMatchResult={createBridgeFunction()}
            tournamentId={tournamentId} // ✅ PASAR TOURNAMENT ID
          />
        )}
      </CardContent>
    </Card>
  )
}

export default GranularMatchCard